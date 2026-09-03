import { NextResponse } from "next/server";
import { db } from "@/db";
import { purchases, purchaseItems, suppliers, rawMaterials } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { recordInventoryTransaction } from "@/services/inventory";
import { updateRawMaterial } from "@/services/rawMaterial";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requirePermission("purchases.view");

    const [purchase] = await db
      .select({
        purchase: purchases,
        supplierName: suppliers.name,
      })
      .from(purchases)
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .where(eq(purchases.id, id))
      .limit(1);

    if (!purchase) {
      return NextResponse.json({ success: false, error: "فاکتور خرید یافت نشد." }, { status: 404 });
    }

    const items = await db
      .select({
        item: purchaseItems,
        rawMaterialName: rawMaterials.name,
        rawMaterialCode: rawMaterials.code,
      })
      .from(purchaseItems)
      .leftJoin(rawMaterials, eq(purchaseItems.itemId, rawMaterials.id))
      .where(eq(purchaseItems.purchaseId, id));

    return NextResponse.json({
      success: true,
      purchase: {
        ...purchase.purchase,
        supplierName: purchase.supplierName,
        grandTotal: Number(purchase.purchase.grandTotal),
        paidAmount: Number(purchase.purchase.paidAmount),
        items: items.map((i) => ({
          ...i.item,
          rawMaterialName: i.rawMaterialName || "نامشخص",
          rawMaterialCode: i.rawMaterialCode || "-",
          quantity: Number(i.item.quantity),
          unitCost: Number(i.item.unitCost),
          totalCost: Number(i.item.totalCost),
        })),
      },
    });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const context = await requirePermission("purchases.edit");

    const [existing] = await db.select().from(purchases).where(eq(purchases.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, error: "فاکتور خرید یافت نشد." }, { status: 404 });
    }

    const oldItems = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));

    let grandTotal = Number(existing.grandTotal);
    const updatePayload: Record<string, any> = { updatedAt: new Date() };

    if (body.supplierId) updatePayload.supplierId = body.supplierId;
    if (body.projectId !== undefined) updatePayload.projectId = body.projectId || null;
    if (body.notes !== undefined) updatePayload.notes = body.notes || null;
    if (body.paidAmount !== undefined) updatePayload.paidAmount = body.paidAmount.toString();

    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      for (const old of oldItems) {
        if (old.itemType === "raw_material") {
          await recordInventoryTransaction({
            itemType: "raw_material",
            itemId: old.itemId,
            transactionType: "adjustment",
            quantityChange: -Number(old.quantity),
            unitCostSnapshot: Number(old.unitCost),
            referenceType: "purchase_edit_reverse",
            referenceId: id,
            notes: `برگشت انبار به دلیل ویرایش فاکتور خرید #${existing.purchaseNumber}`,
            allowNegativeStock: true,
          });
        }
      }

      await db.delete(purchaseItems).where(eq(purchaseItems.purchaseId, id));

      grandTotal = 0;
      for (const item of body.items) {
        const qty = Number(item.quantity) || 0;
        const unitCost = Number(item.unitCost) || 0;
        const totalCost = qty * unitCost;
        grandTotal += totalCost;

        await db.insert(purchaseItems).values({
          purchaseId: id,
          itemType: item.itemType || "raw_material",
          itemId: item.itemId,
          quantity: qty.toString(),
          unit: item.unit || "عدد",
          unitCost: unitCost.toString(),
          totalCost: totalCost.toString(),
        });

        if (item.itemType === "raw_material" || !item.itemType) {
          await recordInventoryTransaction({
            itemType: "raw_material",
            itemId: item.itemId,
            transactionType: "purchase",
            quantityChange: qty,
            unitCostSnapshot: unitCost,
            referenceType: "purchase",
            referenceId: id,
            notes: `ورود به انبار از ویرایش فاکتور خرید #${existing.purchaseNumber}`,
          });

          await updateRawMaterial(item.itemId, {
            currentCost: unitCost,
            priceChangeReason: `ویرایش قیمت از فاکتور خرید #${existing.purchaseNumber}`,
          });
        }
      }

      updatePayload.subtotal = grandTotal.toString();
      updatePayload.grandTotal = grandTotal.toString();
    }

    const [updated] = await db
      .update(purchases)
      .set(updatePayload)
      .where(eq(purchases.id, id))
      .returning();

    await logAuditEvent("UPDATE", "purchase", id, {
      purchaseNumber: existing.purchaseNumber,
      grandTotal,
      supplierId: updated.supplierId,
    }, { userId: context.employeeId, userName: context.roleCode });

    return NextResponse.json({
      success: true,
      purchase: updated,
      message: `فاکتور خرید #${existing.purchaseNumber} با موفقیت ویرایش شد.`,
    });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requirePermission("purchases.delete");

    const [existing] = await db.select().from(purchases).where(eq(purchases.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, error: "فاکتور خرید یافت نشد." }, { status: 404 });
    }

    const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));

    for (const item of items) {
      if (item.itemType === "raw_material") {
        await recordInventoryTransaction({
          itemType: "raw_material",
          itemId: item.itemId,
          transactionType: "adjustment",
          quantityChange: -Number(item.quantity),
          unitCostSnapshot: Number(item.unitCost),
          referenceType: "purchase_void",
          referenceId: id,
          notes: `ابطال فاکتور خرید #${existing.purchaseNumber}`,
          allowNegativeStock: true,
        });
      }
    }

    await db.delete(purchaseItems).where(eq(purchaseItems.purchaseId, id));
    await db.delete(purchases).where(eq(purchases.id, id));

    await logAuditEvent("DELETE", "purchase", id, {
      purchaseNumber: existing.purchaseNumber,
      grandTotal: existing.grandTotal,
    }, { userId: context.employeeId, userName: context.roleCode });

    return NextResponse.json({
      success: true,
      message: `فاکتور خرید #${existing.purchaseNumber} با موفقیت ابطال و از انبار کسر گردید.`,
    });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
