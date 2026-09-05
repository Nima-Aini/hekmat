import { recordInventoryTransaction } from "@/services/inventory";
import { apiError, ApiError, assertUuid } from "@/lib/apiError";
import { productInput, deleteOrArchiveProduct } from "@/services/product";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productRecipes, rawMaterials, projectProductPrices, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateProductCostFromBOM } from "@/services/pricing";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("products.view");
    const { id } = await params;
    assertUuid(id);
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) {
      return NextResponse.json({ success: false, error: "محصول یافت نشد" }, { status: 404 });
    }

    const recipes = await db
      .select({
        id: productRecipes.id,
        rawMaterialId: productRecipes.rawMaterialId,
        rawMaterialName: rawMaterials.name,
        rawMaterialCode: rawMaterials.code,
        unit: rawMaterials.unit,
        currentCost: rawMaterials.currentCost,
        quantityRequired: productRecipes.quantityRequired,
        wastagePercent: productRecipes.wastagePercent,
      })
      .from(productRecipes)
      .innerJoin(rawMaterials, eq(productRecipes.rawMaterialId, rawMaterials.id))
      .where(eq(productRecipes.productId, id));

    const projectPrices = await db
      .select({
        id: projectProductPrices.id,
        projectId: projectProductPrices.projectId,
        projectName: projects.name,
        customPrice: projectProductPrices.customPrice,
      })
      .from(projectProductPrices)
      .innerJoin(projects, eq(projectProductPrices.projectId, projects.id))
      .where(eq(projectProductPrices.productId, id));

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        basePrice: Number(product.basePrice),
        calculatedCost: Number(product.calculatedCost),
        stockQuantity: Number(product.stockQuantity),
        minStockQuantity: Number(product.minStockQuantity),
      },
      recipes,
      projectPrices,
    });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("products.update");
    const { id } = await params;
    assertUuid(id);
    const body = await req.json();

    const { data, recipes } = productInput(body);
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(products).where(eq(products.id, id)).for("update").limit(1);
      if (!existing) throw new ApiError(404, "محصول یافت نشد.");
      const { stockQuantity, ...details } = data;
      if (stockQuantity !== undefined && Number(stockQuantity) !== Number(existing.stockQuantity)) {
        await recordInventoryTransaction({ itemId: id, itemType: "product", transactionType: "adjustment", quantityChange: Number(stockQuantity) - Number(existing.stockQuantity), notes: "ویرایش موجودی محصول" }, tx);
      }
      await tx.update(products).set({ ...details, updatedAt: new Date() }).where(eq(products.id, id));
      if (recipes !== undefined) {
        await tx.delete(productRecipes).where(eq(productRecipes.productId, id));
        if (recipes.length) await tx.insert(productRecipes).values(recipes.map(r => ({ ...r, productId: id })));
        await updateProductCostFromBOM(id, tx);
      }
      return (await tx.select().from(products).where(eq(products.id, id)))[0];
    });

    await logAuditEvent("UPDATE", "product", id, { name: updated.name });
    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("products.delete");
    const { id } = await params;
    assertUuid(id);

    const result = await deleteOrArchiveProduct(id);
    await logAuditEvent(result.archived ? "ARCHIVE" : "DELETE", "product", id, { code: result.product.code, name: result.product.name });
    return NextResponse.json({ success: true, archived: result.archived, message: result.message });
  } catch (error: any) {
    return apiError(error);
  }
}
