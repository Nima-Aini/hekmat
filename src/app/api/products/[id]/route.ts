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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("products.update");
    const { id } = await params;
    const body = await req.json();

    const updateData: any = {
      name: body.name,
      category: body.category,
      unit: body.unit,
      description: body.description !== undefined ? body.description : undefined,
      imageUrl: body.imageUrl !== undefined ? body.imageUrl : undefined,
      updatedAt: new Date(),
    };

    if (body.code) updateData.code = body.code;
    if (body.basePrice !== undefined) updateData.basePrice = body.basePrice.toString();
    if (body.stockQuantity !== undefined) updateData.stockQuantity = body.stockQuantity.toString();
    if (body.minStockQuantity !== undefined) updateData.minStockQuantity = body.minStockQuantity.toString();
    if (body.status !== undefined) updateData.status = body.status;
    if (body.isSpecial !== undefined) updateData.isSpecial = !!body.isSpecial;

    const [updated] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    // If recipes update provided, replace recipe entries
    if (body.recipes && Array.isArray(body.recipes)) {
      await db.delete(productRecipes).where(eq(productRecipes.productId, id));
      for (const recipe of body.recipes) {
        await db.insert(productRecipes).values({
          productId: id,
          rawMaterialId: recipe.rawMaterialId,
          quantityRequired: recipe.quantityRequired.toString(),
          wastagePercent: recipe.wastagePercent ? recipe.wastagePercent.toString() : "0",
        });
      }
      await updateProductCostFromBOM(id);
    }

    await logAuditEvent("UPDATE", "product", id, { name: updated.name });
    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("products.delete");
    const { id } = await params;

    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, error: "محصول یافت نشد." }, { status: 404 });
    }

    await db.delete(products).where(eq(products.id, id));

    await logAuditEvent("DELETE", "product", id, { code: existing.code, name: existing.name });
    return NextResponse.json({
      success: true,
      message: `محصول «${existing.name}» (${existing.code}) با موفقیت حذف شد.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
