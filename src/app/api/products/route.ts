import { recordInventoryTransaction } from "@/services/inventory";
import { apiError, ApiError, assertUuid, decimal } from "@/lib/apiError";
import { productInput } from "@/services/product";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productRecipes, rawMaterials, projectProductPrices } from "@/db/schema";
import { desc, eq, and, ne } from "drizzle-orm";
import { updateProductCostFromBOM } from "@/services/pricing";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";
import { getNextSequenceCode } from "@/services/sequence";

export async function GET(req: Request) {
  try {
    await requirePermission("products.view");
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (projectId) assertUuid(projectId);
    const list = await db.select().from(products).where(ne(products.status, "archived")).orderBy(desc(products.createdAt));

    let projectPricesMap = new Map<string, number>();
    if (projectId) {
      const pPrices = await db
        .select()
        .from(projectProductPrices)
        .where(eq(projectProductPrices.projectId, projectId));
      for (const pp of pPrices) {
        if (pp.customPrice !== null) {
          projectPricesMap.set(pp.productId, Number(pp.customPrice));
        }
      }
    }

    const formatted = list.map((p) => {
      const basePrice = Number(p.basePrice) || 0;
      const projectPrice = projectPricesMap.get(p.id);
      const effectivePrice = projectPrice !== undefined ? projectPrice : basePrice;

      return {
        ...p,
        basePrice,
        effectivePrice,
        hasProjectOverride: projectPrice !== undefined,
        calculatedCost: Number(p.calculatedCost),
        stockQuantity: Number(p.stockQuantity),
        minStockQuantity: Number(p.minStockQuantity),
        isLowStock: Number(p.stockQuantity) <= Number(p.minStockQuantity),
      };
    });

    return NextResponse.json({ success: true, products: formatted });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await requirePermission(body?.action === "update_project_price" ? "projects.price.manage" : body?.action === "adjust_stock" ? "products.update" : "products.create", body?.action === "update_project_price" ? body.projectId : undefined);

    // Handle stock adjustment
    if (body.action === "adjust_stock") {
      const { productId, newQuantity, reason } = body;
      if (!productId || newQuantity === undefined) {
        return NextResponse.json({ success: false, error: "شناسه محصول و مقدار موجودی الزامی است." }, { status: 400 });
      }

      assertUuid(productId);
      decimal(newQuantity, "موجودی", 4);
      const updated = await db.transaction(async (tx) => {
        const [prod] = await tx.select().from(products).where(eq(products.id, productId)).for("update").limit(1);
        if (!prod) throw new ApiError(404, "محصول یافت نشد.");
        await recordInventoryTransaction({ itemId: productId, itemType: "product", transactionType: "adjustment", quantityChange: Number(newQuantity) - Number(prod.stockQuantity), notes: typeof reason === "string" ? reason : "تعدیل دستی انبار" }, tx);
        return (await tx.select().from(products).where(eq(products.id, productId)))[0];
      });

      return NextResponse.json({ success: true, product: updated });
    }

    // PROMPT FIX B: Handle project-specific price update strictly matching (projectId + productId)
    if (body.action === "update_project_price") {
      const { projectId, productId, customPrice } = body;
      if (!projectId || !productId || customPrice === undefined) {
        return NextResponse.json(
          { success: false, error: "شناسه پروژه، شناسه محصول و قیمت جدید الزامی است." },
          { status: 400 }
        );
      }

      assertUuid(projectId);
      assertUuid(productId);
      const price = decimal(customPrice, "قیمت پروژه");
      await db.insert(projectProductPrices).values({ projectId, productId, customPrice: price })
        .onConflictDoUpdate({ target: [projectProductPrices.projectId, projectProductPrices.productId], set: { customPrice: price, updatedAt: new Date() } });

      await logAuditEvent("UPDATE_PROJECT_PRICE", "product", productId, { projectId, customPrice });
      return NextResponse.json({ success: true, message: "قیمت پروژه با موفقیت به روز شد." });
    }

    if (body.action) throw new ApiError(400, "عملیات نامعتبر است.");
    const { data, recipes } = productInput(body, true);
    const code = data.code || await getNextSequenceCode(data.isSpecial ? "special_product" : "product");
    const created = await db.transaction(async (tx) => {
      const [product] = await tx.insert(products).values({ ...data, code, name: data.name!, basePrice: data.basePrice! }).returning();
      if (recipes !== undefined) {
        if (recipes.length) await tx.insert(productRecipes).values(recipes.map(r => ({ ...r, productId: product.id })));
        await updateProductCostFromBOM(product.id, tx);
      }
      return (await tx.select().from(products).where(eq(products.id, product.id)))[0];
    });

    await logAuditEvent("CREATE", "product", created.id, { name: created.name, code: created.code });
    return NextResponse.json({ success: true, product: created }, { status: 201 });
  } catch (error: any) {
    return apiError(error);
  }
}
