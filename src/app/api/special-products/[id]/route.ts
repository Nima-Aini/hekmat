import { deleteOrArchiveProduct, productInput } from "@/services/product";
import { assertUuid } from "@/lib/apiError";
import { requirePermission } from "@/services/access";
import { apiError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("products.view");
    const { id } = await params;
    assertUuid(id);
    const items = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.isSpecial, true)))
      .limit(1);

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "محصول اختصاصی یافت نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      specialProduct: items[0],
    });
  } catch (err: any) {
    console.error("Error fetching special product:", err);
    return apiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("products.update");
    const { id } = await params;
    assertUuid(id);
    const body = await req.json();
    const {
      name,
      category,
      unit,
      imageUrl,
      description,
      basePrice,
      stockQuantity,
      minStockQuantity,
      status,
      notes,
    } = body;

    const existing = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.isSpecial, true)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: "محصول اختصاصی یافت نشد." },
        { status: 404 }
      );
    }

    const { data } = productInput(body);
    const updateData = { ...data, isSpecial: true, updatedAt: new Date() };

    const [updated] = await db
      .update(products)
      .set(updateData)
      .where(and(eq(products.id, id), eq(products.isSpecial, true)))
      .returning();

    return NextResponse.json({
      success: true,
      message: "محصول اختصاصی با موفقیت بروزرسانی شد.",
      specialProduct: updated,
    });
  } catch (err: any) {
    console.error("Error updating special product:", err);
    return apiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("products.delete");
    const { id } = await params;
    assertUuid(id);
    const result = await deleteOrArchiveProduct(id, true);
    return NextResponse.json({ success: true, archived: result.archived, message: result.message });
  } catch (err: any) {
    console.error("Error deleting special product:", err);
    return apiError(err);
  }
}
