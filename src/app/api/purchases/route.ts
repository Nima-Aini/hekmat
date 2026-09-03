import { NextResponse } from "next/server";
import { db } from "@/db";
import { purchases, purchaseItems, suppliers, rawMaterials } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { recordInventoryTransaction } from "@/services/inventory";
import { updateRawMaterial } from "@/services/rawMaterial";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    await requirePermission("purchases.view", projectId);

    const list = await db
      .select({
        purchase: purchases,
        supplierName: suppliers.name,
      })
      .from(purchases)
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
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
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const context = await requirePermission("purchases.create", body.projectId || null);

    if (!body.supplierId || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ success: false, error: "انتخاب تامین‌کننده و حداقل یک قلم خرید الزامی است." }, { status: 400 });
    }

    const purNum = `PUR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    let grandTotal = 0;

    for (const item of body.items) {
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.unitCost) || 0;
      if (qty <= 0 || !isFinite(qty)) {
        return NextResponse.json({ success: false, error: "مقدار قلم خرید نامعتبر است." }, { status: 400 });
      }
      if (cost < 0 || !isFinite(cost)) {
        return NextResponse.json({ success: false, error: "قیمت قلم خرید نامعتبر است." }, { status: 400 });
      }
      grandTotal += qty * cost;
    }

    const [createdPurchase] = await db
      .insert(purchases)
      .values({
        purchaseNumber: purNum,
        supplierId: body.supplierId,
        projectId: body.projectId || null,
        subtotal: grandTotal.toString(),
        grandTotal: grandTotal.toString(),
        paidAmount: body.paidAmount ? body.paidAmount.toString() : "0",
        notes: body.notes || null,
      })
      .returning();

    for (const item of body.items) {
      const qty = Number(item.quantity);
      const unitCost = Number(item.unitCost);
      const totalCost = qty * unitCost;

      await db.insert(purchaseItems).values({
        purchaseId: createdPurchase.id,
        itemType: item.itemType || "raw_material",
        itemId: item.itemId,
        quantity: qty.toString(),
        unit: item.unit || "عدد",
        unitCost: unitCost.toString(),
        totalCost: totalCost.toString(),
      });

      if (item.itemType === "raw_material") {
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
        });

        await updateRawMaterial(item.itemId, {
          currentCost: unitCost,
          purchaseQuantity: qty,
          priceChangeReason: `به روزرسانی قیمت از خرید #${purNum}`,
        });
      }
    }

    await logAuditEvent("CREATE", "purchase", createdPurchase.id, {
      purchaseNumber: purNum,
      grandTotal,
      supplierId: body.supplierId,
    }, { userId: context.employeeId, userName: context.roleCode });

    return NextResponse.json({ success: true, purchase: createdPurchase });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
