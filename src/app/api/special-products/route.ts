import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getNextSequenceCode } from "@/services/sequence";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const category = searchParams.get("category")?.trim();
    const status = searchParams.get("status")?.trim();

    // Query unified products where isSpecial is true
    let query = db.select().from(products).where(eq(products.isSpecial, true)).orderBy(desc(products.createdAt));

    const all = await query;
    let filtered = all;

    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(qLower) ||
          p.code.toLowerCase().includes(qLower) ||
          (p.description && p.description.toLowerCase().includes(qLower)) ||
          (p.category && p.category.toLowerCase().includes(qLower))
      );
    }

    if (category && category !== "all") {
      filtered = filtered.filter((p) => p.category === category);
    }

    if (status && status !== "all") {
      filtered = filtered.filter((p) => p.status === status);
    }

    return NextResponse.json({
      success: true,
      specialProducts: filtered,
      count: filtered.length,
    });
  } catch (err: any) {
    console.error("Error fetching special products:", err);
    return NextResponse.json(
      { success: false, error: err.message || "خطا در دریافت لیست محصولات اختصاصی" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      category = "اختصاصی",
      unit = "عدد",
      imageUrl,
      description,
      basePrice = 0,
      stockQuantity = 0,
      minStockQuantity = 0,
      status = "active",
      notes,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "نام محصول اختصاصی الزامی است." },
        { status: 400 }
      );
    }

    // Monotonic unique sequential code (SPC-0001)
    const code = await getNextSequenceCode("special_product");

    const [inserted] = await db
      .insert(products)
      .values({
        code,
        name: name.trim(),
        category: category.trim() || "اختصاصی",
        unit: unit.trim() || "عدد",
        imageUrl: imageUrl?.trim() || null,
        description: description?.trim() || null,
        basePrice: String(Math.max(0, Number(basePrice) || 0)),
        stockQuantity: String(Math.max(0, Number(stockQuantity) || 0)),
        minStockQuantity: String(Math.max(0, Number(minStockQuantity) || 0)),
        status: status === "inactive" ? "inactive" : "active",
        notes: notes?.trim() || null,
        isSpecial: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: "محصول اختصاصی با موفقیت ثبت شد.",
      specialProduct: inserted,
    });
  } catch (err: any) {
    console.error("Error creating special product:", err);
    return NextResponse.json(
      { success: false, error: err.message || "خطا در ثبت محصول اختصاصی" },
      { status: 500 }
    );
  }
}
