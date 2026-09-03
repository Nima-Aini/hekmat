import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productRecipes, rawMaterials, projectProductPrices } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { updateProductCostFromBOM } from "@/services/pricing";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";
import { getNextSequenceCode } from "@/services/sequence";

export async function GET(req: Request) {
  try {
    await requirePermission("products.view");
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const list = await db.select().from(products).orderBy(desc(products.createdAt));

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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await requirePermission(body?.action === "update_project_price" ? "projects.price.manage" : "products.create");

    // Handle stock adjustment
    if (body.action === "adjust_stock") {
      const { productId, newQuantity, reason } = body;
      if (!productId || newQuantity === undefined) {
        return NextResponse.json({ success: false, error: "شناسه محصول و مقدار موجودی الزامی است." }, { status: 400 });
      }

      const [prod] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      if (!prod) return NextResponse.json({ success: false, error: "محصول یافت نشد." }, { status: 404 });

      const currentStock = Number(prod.stockQuantity) || 0;
      const targetStock = Number(newQuantity) || 0;
      const diff = targetStock - currentStock;

      const [updated] = await db
        .update(products)
        .set({ stockQuantity: targetStock.toString(), updatedAt: new Date() })
        .where(eq(products.id, productId))
        .returning();

      await logAuditEvent("ADJUST_STOCK", "product", productId, {
        previousStock: currentStock,
        newStock: targetStock,
        diff,
        reason: reason || "تعدیل دستی انبار",
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

      // Strictly check existing project price on BOTH projectId AND productId
      const [existing] = await db
        .select()
        .from(projectProductPrices)
        .where(
          and(
            eq(projectProductPrices.projectId, projectId),
            eq(projectProductPrices.productId, productId)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(projectProductPrices)
          .set({
            customPrice: customPrice.toString(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(projectProductPrices.projectId, projectId),
              eq(projectProductPrices.productId, productId)
            )
          );
      } else {
        await db.insert(projectProductPrices).values({
          projectId,
          productId,
          customPrice: customPrice.toString(),
        });
      }

      await logAuditEvent("UPDATE_PROJECT_PRICE", "product", productId, { projectId, customPrice });
      return NextResponse.json({ success: true, message: "قیمت پروژه با موفقیت به روز شد." });
    }

    if (!body.name || body.basePrice === undefined) {
      return NextResponse.json(
        { success: false, error: "نام و قیمت پایه محصول الزامی است." },
        { status: 400 }
      );
    }

    let code = body.code?.trim();
    if (!code) {
      code = await getNextSequenceCode(body.isSpecial ? "special_product" : "product");
    }

    const [created] = await db
      .insert(products)
      .values({
        code,
        name: body.name.trim(),
        category: body.category || (body.isSpecial ? "اختصاصی" : "عمومی"),
        unit: body.unit || "عدد",
        imageUrl: body.imageUrl?.trim() || null,
        description: body.description?.trim() || null,
        basePrice: Math.max(0, Number(body.basePrice) || 0).toString(),
        calculatedCost: body.calculatedCost ? body.calculatedCost.toString() : "0",
        stockQuantity: body.stockQuantity ? Math.max(0, Number(body.stockQuantity) || 0).toString() : "0",
        minStockQuantity: body.minStockQuantity ? Math.max(0, Number(body.minStockQuantity) || 0).toString() : "5",
        status: body.status || "active",
        isSpecial: !!body.isSpecial,
      })
      .returning();

    // If BOM recipes provided, save recipes
    if (body.recipes && Array.isArray(body.recipes)) {
      for (const recipe of body.recipes) {
        await db.insert(productRecipes).values({
          productId: created.id,
          rawMaterialId: recipe.rawMaterialId,
          quantityRequired: recipe.quantityRequired.toString(),
          wastagePercent: recipe.wastagePercent ? recipe.wastagePercent.toString() : "0",
        });
      }
      await updateProductCostFromBOM(created.id);
    }

    await logAuditEvent("CREATE", "product", created.id, { name: created.name, code: created.code });
    return NextResponse.json({ success: true, product: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
