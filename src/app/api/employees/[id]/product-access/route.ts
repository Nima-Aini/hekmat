import { assertUuid } from "@/lib/apiError";
import { requirePermission } from "@/services/access";
import { apiError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { employees, employeeProjectAssignments, products, specialProducts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("employees.manage");
    const { id } = await params;
    assertUuid(id);
    const [emp] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp) {
      return NextResponse.json({ success: false, error: "همکار یافت نشد" }, { status: 404 });
    }

    // Get assignments
    const assignments = await db
      .select()
      .from(employeeProjectAssignments)
      .where(eq(employeeProjectAssignments.employeeId, id));

    // Retrieve product permission configuration from assignment or default
    let allowedProductIds: string[] = [];
    let allowedSpecialProductIds: string[] = [];
    let canSellAllProducts = true;

    for (const a of assignments) {
      const pSet = (a.permissionSet as any) || {};
      if (pSet.productAccess) {
        canSellAllProducts = pSet.productAccess.canSellAllProducts !== false;
        allowedProductIds = Array.isArray(pSet.productAccess.allowedProductIds)
          ? pSet.productAccess.allowedProductIds
          : [];
        allowedSpecialProductIds = Array.isArray(pSet.productAccess.allowedSpecialProductIds)
          ? pSet.productAccess.allowedSpecialProductIds
          : [];
        break;
      }
    }

    // Fetch all products & special products for selection
    const allProducts = await db
      .select({
        id: products.id,
        code: products.code,
        name: products.name,
        category: products.category,
        unit: products.unit,
        basePrice: products.basePrice,
        stockQuantity: products.stockQuantity,
      })
      .from(products)
      .where(and(eq(products.status, "active"), eq(products.isSpecial, false)));

    let allSpecialProducts: any[] = await db
      .select({
        id: products.id,
        code: products.code,
        name: products.name,
        category: products.category,
        unit: products.unit,
        basePrice: products.basePrice,
        stockQuantity: products.stockQuantity,
      })
      .from(products)
      .where(and(eq(products.status, "active"), eq(products.isSpecial, true)));

    try {
      const legacySp = await db
        .select({
          id: specialProducts.id,
          code: specialProducts.code,
          name: specialProducts.name,
          category: specialProducts.category,
          unit: specialProducts.unit,
          basePrice: specialProducts.basePrice,
          stockQuantity: specialProducts.stockQuantity,
        })
        .from(specialProducts)
        .where(eq(specialProducts.status, "active"));
      allSpecialProducts = [...allSpecialProducts, ...legacySp];
    } catch (err) {
      // Safe fallback
    }

    return NextResponse.json({
      success: true,
      data: {
        employeeId: id,
        employeeName: emp.name,
        canSellAllProducts,
        allowedProductIds,
        allowedSpecialProductIds,
        allProducts,
        allSpecialProducts,
      },
    });
  } catch (error: any) {
    console.error("Error fetching employee product access:", error);
    return apiError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("employees.manage");
    const { id } = await params;
    assertUuid(id);
    const body = await req.json();
    const { canSellAllProducts, allowedProductIds, allowedSpecialProductIds } = body;

    const [emp] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp) {
      return NextResponse.json({ success: false, error: "همکار یافت نشد" }, { status: 404 });
    }

    // Update product access in assignments
    const assignments = await db
      .select()
      .from(employeeProjectAssignments)
      .where(eq(employeeProjectAssignments.employeeId, id));

    const productAccessPayload = {
      canSellAllProducts: Boolean(canSellAllProducts),
      allowedProductIds: Array.isArray(allowedProductIds) ? allowedProductIds : [],
      allowedSpecialProductIds: Array.isArray(allowedSpecialProductIds) ? allowedSpecialProductIds : [],
      updatedAt: new Date().toISOString(),
    };

    for (const a of assignments) {
      const currentPSet = (a.permissionSet as any) || {};
      const updatedPSet = {
        ...currentPSet,
        productAccess: productAccessPayload,
      };

      await db
        .update(employeeProjectAssignments)
        .set({ permissionSet: updatedPSet })
        .where(eq(employeeProjectAssignments.id, a.id));
    }

    await logAuditEvent(
      "UPDATE_EMPLOYEE_PRODUCT_PERMISSIONS",
      "employee",
      id,
      {
        employeeName: emp.name,
        productAccess: productAccessPayload,
      }
    );

    return NextResponse.json({
      success: true,
      message: "دسترسی فروش کالاها و محصولات اختصاصی همکار با موفقیت ذخیره شد.",
      data: productAccessPayload,
    });
  } catch (error: any) {
    console.error("Error saving employee product access:", error);
    return apiError(error);
  }
}
