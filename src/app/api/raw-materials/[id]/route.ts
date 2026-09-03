import { NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterials } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateRawMaterial, getRawMaterialPriceHistory, deleteRawMaterial } from "@/services/rawMaterial";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await deleteRawMaterial(id);
    return NextResponse.json({ success: true, message: `ماده اولیه "${result.deletedName}" با موفقیت حذف گردید.` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
