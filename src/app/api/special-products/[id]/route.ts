import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    return NextResponse.json(
      { success: false, error: err.message || "خطا در دریافت اطلاعات محصول اختصاصی" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { success: false, error: "نام محصول الزامی است." },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (category !== undefined) updateData.category = category.trim() || "اختصاصی";
    if (unit !== undefined) updateData.unit = unit.trim() || "عدد";
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl?.trim() || null;
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (basePrice !== undefined) updateData.basePrice = String(Math.max(0, Number(basePrice) || 0));
    if (stockQuantity !== undefined) updateData.stockQuantity = String(Math.max(0, Number(stockQuantity) || 0));
    if (minStockQuantity !== undefined) updateData.minStockQuantity = String(Math.max(0, Number(minStockQuantity) || 0));
    if (status !== undefined) updateData.status = status === "inactive" ? "inactive" : "active";
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

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
    return NextResponse.json(
      { success: false, error: err.message || "خطا در بروزرسانی محصول اختصاصی" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    await db.delete(products).where(and(eq(products.id, id), eq(products.isSpecial, true)));

    return NextResponse.json({
      success: true,
      message: `محصول اختصاصی «${existing[0].name}» (${existing[0].code}) با موفقیت حذف گردید.`,
    });
  } catch (err: any) {
    console.error("Error deleting special product:", err);
    return NextResponse.json(
      { success: false, error: err.message || "خطا در حذف محصول اختصاصی" },
      { status: 500 }
    );
  }
}
