import { productInput } from "@/services/product";
import { requirePermission } from "@/services/access";
import { apiError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import { getNextSequenceCode } from "@/services/sequence";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("products.view");
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const category = searchParams.get("category")?.trim();
    const status = searchParams.get("status")?.trim();

    // Query unified products where isSpecial is true
    let query = db.select().from(products).where(and(eq(products.isSpecial, true), ne(products.status, "archived"))).orderBy(desc(products.createdAt));

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
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("products.create");
    const body = await req.json();
    const { data } = productInput({ ...body, basePrice: body.basePrice ?? 0, isSpecial: true }, true);
    // Monotonic unique sequential code (SPC-0001)
    const code = await getNextSequenceCode("special_product");

    const [inserted] = await db
      .insert(products)
      .values({ ...data, code, name: data.name!, isSpecial: true })
      .returning();

    return NextResponse.json({
      success: true,
      message: "محصول اختصاصی با موفقیت ثبت شد.",
      specialProduct: inserted,
    });
  } catch (err: any) {
    console.error("Error creating special product:", err);
    return apiError(err);
  }
}
