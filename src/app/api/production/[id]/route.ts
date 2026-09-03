import { NextResponse } from "next/server";
import { deleteProductionBatch } from "@/services/production";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "شناسه بچ تولید الزامی است." }, { status: 400 });
    }

    const result = await deleteProductionBatch(id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
