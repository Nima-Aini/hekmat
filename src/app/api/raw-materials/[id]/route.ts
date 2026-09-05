import { assertUuid } from "@/lib/apiError";
import { requirePermission } from "@/services/access";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterials } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateRawMaterial, getRawMaterialPriceHistory, deleteRawMaterial } from "@/services/rawMaterial";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("raw_materials.view");
    const { id } = await params;
    assertUuid(id);
    const [rm] = await db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).limit(1);
    if (!rm) {
      return NextResponse.json({ success: false, error: "ماده اولیه یافت نشد" }, { status: 404 });
    }

    const priceHistory = await getRawMaterialPriceHistory(id);

    return NextResponse.json({
      success: true,
      rawMaterial: {
        ...rm,
        stockQuantity: Number(rm.stockQuantity),
        minStockQuantity: Number(rm.minStockQuantity),
        currentCost: Number(rm.currentCost),
        averageCost: Number(rm.averageCost),
      },
      priceHistory,
    });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("raw_materials.update");
    const { id } = await params;
    assertUuid(id);
    const body = await req.json();

    const updated = await updateRawMaterial(id, {
      name: body.name,
      code: body.code,
      unit: body.unit,
      unitConversionFactor: body.unitConversionFactor ? Number(body.unitConversionFactor) : undefined,
      secondaryUnit: body.secondaryUnit,
      minStockQuantity: body.minStockQuantity !== undefined ? Number(body.minStockQuantity) : undefined,
      currentCost: body.currentCost !== undefined ? Number(body.currentCost) : undefined,
      supplierId: body.supplierId,
      costPolicy: body.costPolicy,
      status: body.status,
      notes: body.notes,
      priceChangeReason: body.priceChangeReason || "ویرایش مستقیم کاربر",
    });

    return NextResponse.json({ success: true, rawMaterial: updated });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("raw_materials.update");
    const { id } = await params;
    assertUuid(id);
    const result = await deleteRawMaterial(id);
    return NextResponse.json({ success: true, message: `ماده اولیه "${result.deletedName}" با موفقیت حذف گردید.` });
  } catch (error: any) {
    return apiError(error);
  }
}
