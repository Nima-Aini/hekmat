import { requirePermission } from "@/services/access";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { productionBatches, products, projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { executeProductionBatch, RawMaterialShortageError } from "@/services/production";
import { requestIdentity } from "@/lib/idempotency";

export async function GET() {
  try {
    await requirePermission("production.view");
    const list = await db
      .select({
        batch: productionBatches,
        productName: products.name,
        projectName: projects.name,
      })
      .from(productionBatches)
      .innerJoin(products, eq(productionBatches.productId, products.id))
      .leftJoin(projects, eq(productionBatches.projectId, projects.id))
      .orderBy(desc(productionBatches.createdAt));

    const formatted = list.map(({ batch, productName, projectName }) => ({
      ...batch,
      productName,
      projectName: projectName || "عمومی",
      quantityProduced: Number(batch.quantityProduced),
      totalBatchCost: Number(batch.totalBatchCost),
      unitCost: Number(batch.unitCost),
    }));

    return NextResponse.json({ success: true, batches: formatted });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission("production.create");
    const body = await req.json();

    if (!body.productId || !body.quantityToProduce) {
      return NextResponse.json(
        { success: false, error: "شناسه محصول و تعداد تولید الزامی است." },
        { status: 400 }
      );
    }

    const created = await executeProductionBatch({
      ...requestIdentity(req, context.employeeId, body),
      productId: body.productId,
      projectId: body.projectId || null,
      quantityToProduce: Number(body.quantityToProduce),
      laborCost: body.laborCost ? Number(body.laborCost) : 0,
      overheadCost: body.overheadCost ? Number(body.overheadCost) : 0,
      packagingCost: body.packagingCost ? Number(body.packagingCost) : 0,
      notes: body.notes,
    });

    return NextResponse.json({ success: true, batch: created });
  } catch (error: any) {
    if (error instanceof RawMaterialShortageError) return NextResponse.json({ success: false, code: error.code, error: error.message, shortages: error.shortages }, { status: 409 });
    return apiError(error);
  }
}
