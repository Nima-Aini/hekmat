import { ApiError, apiError, assertUuid, decimal } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { purchases, purchaseItems, suppliers, rawMaterials } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { recordInventoryTransaction } from "@/services/inventory";
import { updateRawMaterial } from "@/services/rawMaterial";
import { logAuditEvent } from "@/services/audit";
import { getScopedProjectIds, requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    await requirePermission("purchases.view", projectId);
    const scope = await getScopedProjectIds();
    const conditions = [];
    if (projectId) conditions.push(eq(purchases.projectId, projectId));
    if (!projectId && scope) {
      conditions.push(scope.length ? inArray(purchases.projectId, scope) : sql`false`);
    }

    const list = await db
      .select({
        purchase: purchases,
        supplierName: suppliers.name,
      })
      .from(purchases)
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(purchases.createdAt));

    const formatted = list.map(({ purchase, supplierName }) => ({
      ...purchase,
      supplierName,
      grandTotal: Number(purchase.grandTotal),
      paidAmount: Number(purchase.paidAmount),
    }));

    return NextResponse.json({ success: true, purchases: formatted });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const context = await requirePermission("purchases.create", body.projectId || null);

    if (!body.supplierId || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ success: false, error: "انتخاب تامین‌کننده و حداقل یک قلم خرید الزامی است." }, { status: 400 });
    }
    assertUuid(body.supplierId);
    if (body.projectId) assertUuid(body.projectId);
    if (Number(body.paidAmount || 0) !== 0) {
      throw new ApiError(400, "پرداخت خرید باید از مسیر تراکنش مالی ثبت شود.");
    }

    return await db.transaction(async (tx) => {
    const purNum = `PUR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    let grandTotal = 0;

    for (const item of body.items) {
      assertUuid(item.itemId);
      if (item.itemType !== undefined && !["raw_material", "product"].includes(item.itemType)) {
        throw new ApiError(400, "نوع قلم خرید معتبر نیست.");
      }
      const qty = Number(decimal(item.quantity, "مقدار خرید", 4, true));
      const cost = Number(decimal(item.unitCost, "قیمت قلم خرید"));
      grandTotal += qty * cost;
    }

    const [createdPurchase] = await tx
      .insert(purchases)
      .values({
        purchaseNumber: purNum,
        supplierId: body.supplierId,
        projectId: body.projectId || null,
        subtotal: grandTotal.toString(),
        grandTotal: grandTotal.toString(),
        paidAmount: "0",
        notes: body.notes || null,
      })
      .returning();

    for (const item of body.items) {
      const qty = Number(item.quantity);
      const unitCost = Number(item.unitCost);
      const totalCost = qty * unitCost;

      await tx.insert(purchaseItems).values({
        purchaseId: createdPurchase.id,
        itemType: item.itemType || "raw_material",
        itemId: item.itemId,
        quantity: qty.toString(),
        unit: item.unit || "عدد",
        unitCost: unitCost.toString(),
        totalCost: totalCost.toString(),
      });

      const itemType = item.itemType === "product" ? "product" : "raw_material";
      if (itemType === "raw_material") {
        await recordInventoryTransaction({
          itemType: "raw_material",
          itemId: item.itemId,
          transactionType: "purchase",
          quantityChange: qty,
          unitCostSnapshot: unitCost,
          referenceType: "purchase",
          referenceId: createdPurchase.id,
          projectId: body.projectId || null,
          notes: `خرید فاکتور شماره #${purNum}`,
        }, tx);

        await updateRawMaterial(item.itemId, {
          currentCost: unitCost,
          purchaseQuantity: qty,
          priceChangeReason: `به روزرسانی قیمت از خرید #${purNum}`,
        }, tx);
      } else {
        await recordInventoryTransaction({
          itemType: "product",
          itemId: item.itemId,
          transactionType: "purchase",
          quantityChange: qty,
          unitCostSnapshot: unitCost,
          referenceType: "purchase",
          referenceId: createdPurchase.id,
          projectId: body.projectId || null,
          notes: `خرید فاکتور شماره #${purNum}`,
        }, tx);
      }
    }

    await logAuditEvent("CREATE", "purchase", createdPurchase.id, {
      purchaseNumber: purNum,
      grandTotal,
      supplierId: body.supplierId,
    }, { userId: context.employeeId, userName: context.roleCode }, tx);

    return NextResponse.json({ success: true, purchase: createdPurchase });
    });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return apiError(error);
  }
}
