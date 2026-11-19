import { ApiError, decimal } from "@/lib/apiError";
import { db } from "@/db";
import {
  productionBatches,
  productionBatchItems,
  productRecipes,
  rawMaterials,
  products,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { recordInventoryTransaction } from "./inventory";
import { logAuditEvent } from "./audit";
import { calculateProductionRequirements } from "@/lib/productionRequirements";

export interface CreateProductionBatchInput {
  requestKey?: string;
  requestHash?: string;
  productId: string;
  projectId?: string | null;
  quantityToProduce: number;
  laborCost?: number;
  overheadCost?: number;
  packagingCost?: number;
  notes?: string;
}

export class RawMaterialShortageError extends ApiError {
  readonly code = "INSUFFICIENT_RAW_MATERIALS";
  constructor(public shortages: ReturnType<typeof calculateProductionRequirements>["shortages"]) {
    super(409, `موجودی ${shortages.length.toLocaleString("fa-IR")} ماده اولیه کافی نیست.`);
  }
}

/**
 * Executes a production batch process transactionally.
 */
export async function executeProductionBatch(input: CreateProductionBatchInput) {
  decimal(input.quantityToProduce, "مقدار تولید", 4, true);
  for (const amount of [input.laborCost, input.overheadCost, input.packagingCost]) decimal(amount ?? 0, "هزینه تولید");
  return await db.transaction(async (tx) => {
    if (input.requestKey) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestKey}, 0))`);
      const [prior] = await tx.select().from(productionBatches).where(eq(productionBatches.requestKey, input.requestKey)).limit(1);
      if (prior) {
        if (prior.requestHash !== input.requestHash) throw new ApiError(409, "این کلید درخواست قبلاً برای تولید دیگری استفاده شده است.");
        return prior;
      }
    }
    const [product] = await tx.select().from(products).where(eq(products.id, input.productId)).limit(1);
    if (!product) throw new ApiError(404, "محصول مورد نظر یافت نشد.");
    if (product.status !== "active") throw new ApiError(409, "محصول غیرفعال قابل تولید نیست.");

    const recipes = await tx
      .select({
        id: productRecipes.id,
        rawMaterialId: productRecipes.rawMaterialId,
        quantityRequired: productRecipes.quantityRequired,
        wastagePercent: productRecipes.wastagePercent,
        rawMaterialName: rawMaterials.name,
        currentStock: rawMaterials.stockQuantity,
        unitCost: rawMaterials.currentCost,
        averageCost: rawMaterials.averageCost,
        costPolicy: rawMaterials.costPolicy,
      })
      .from(productRecipes)
      .innerJoin(rawMaterials, eq(productRecipes.rawMaterialId, rawMaterials.id))
      .where(eq(productRecipes.productId, input.productId));

    if (recipes.length === 0) {
      throw new ApiError(409, `برای محصول «${product.name}» فرمول تولید تعریف نشده است.`);
    }

    const batchQty = input.quantityToProduce;
    // Lock every material in a stable order before checking stock. Concurrent batches
    // then re-read the latest committed quantities under the same transaction.
    const materialIds = [...new Set(recipes.map((r) => r.rawMaterialId))].sort();
    const locked = new Map();
    for (const id of materialIds) {
      const [material] = await tx.select().from(rawMaterials).where(eq(rawMaterials.id, id)).for("update");
      if (!material || material.status !== "active") throw new ApiError(409, "یکی از مواد اولیه فرمول غیرفعال یا حذف شده است.");
      locked.set(id, material);
    }
    const { requirements: materialRequirements, shortages } = calculateProductionRequirements(recipes.map((r) => {
      const material = locked.get(r.rawMaterialId)!;
      return {
        rawMaterialId: r.rawMaterialId, rawMaterialName: material.name, code: material.code,
        unit: material.unit, stock: material.stockQuantity,
        quantityRequired: r.quantityRequired, wastagePercent: r.wastagePercent,
        unitCost: material.costPolicy === "average" ? Number(material.averageCost) || Number(material.currentCost) : Number(material.currentCost),
      };
    }), batchQty);
    if (shortages.length) throw new RawMaterialShortageError(shortages);

    const batchNum = `BATCH-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
    let totalMaterialCost = 0;
    for (const m of materialRequirements) {
      totalMaterialCost += Math.round(Number(m.required) * m.unitCost * 100) / 100;
    }

    const laborCost = input.laborCost || 0;
    const overheadCost = input.overheadCost || 0;
    const packagingCost = input.packagingCost || 0;

    if (laborCost < 0 || overheadCost < 0 || packagingCost < 0) {
      throw new Error("هزینه‌ها نمی‌توانند منفی باشند.");
    }

    const totalBatchCost = Math.round((totalMaterialCost + laborCost + overheadCost + packagingCost) * 100) / 100;
    const unitCost = batchQty > 0 ? Math.round((totalBatchCost / batchQty) * 100) / 100 : 0;

    const [createdBatch] = await tx
      .insert(productionBatches)
      .values({
        requestKey: input.requestKey,
        requestHash: input.requestHash,
        batchNumber: batchNum,
        productId: input.productId,
        projectId: input.projectId || null,
        quantityProduced: batchQty.toString(),
        totalMaterialCost: totalMaterialCost.toString(),
        laborCost: laborCost.toString(),
        overheadCost: overheadCost.toString(),
        packagingCost: packagingCost.toString(),
        totalBatchCost: totalBatchCost.toString(),
        unitCost: unitCost.toString(),
        status: "completed",
        notes: input.notes || null,
      })
      .returning();

    for (const m of materialRequirements) {
      try {
        await tx.insert(productionBatchItems).values({
          batchId: createdBatch.id,
          rawMaterialId: m.materialId,
          quantityConsumed: m.required,
          unitCostSnapshot: m.unitCost.toString(),
          totalCostSnapshot: (Math.round(Number(m.required) * m.unitCost * 100) / 100).toString(),
          wasteQuantity: "0",
        });
      } catch (insertErr: any) {
        console.error("Batch item insert error:", insertErr);
        throw insertErr;
      }

      await recordInventoryTransaction(
        {
          itemType: "raw_material",
          itemId: m.materialId,
          transactionType: "production_input",
          quantityChange: -Number(m.required),
          unitCostSnapshot: m.unitCost,
          referenceType: "production_batch",
          referenceId: createdBatch.id,
          projectId: input.projectId || null,
          notes: `مصرف در بچ تولید #${batchNum}`,
        },
        tx
      );
    }

    await recordInventoryTransaction(
      {
        itemType: "product",
        itemId: input.productId,
        transactionType: "production_output",
        quantityChange: batchQty,
        unitCostSnapshot: unitCost,
        referenceType: "production_batch",
        referenceId: createdBatch.id,
        projectId: input.projectId || null,
        notes: `خروجی بچ تولید #${batchNum}`,
      },
      tx
    );

    await tx
      .update(products)
      .set({
        calculatedCost: unitCost.toString(),
        updatedAt: new Date(),
      })
      .where(eq(products.id, input.productId));

    await logAuditEvent("PRODUCTION_COMPLETE", "production_batch", createdBatch.id, {
      batchNumber: batchNum,
      productName: product.name,
      quantityProduced: batchQty,
      totalBatchCost,
      unitCost,
    }, undefined, tx);

    return createdBatch;
  });
}

/**
 * Deletes and voids a production batch, reversing inventory transactions
 */
export async function deleteProductionBatch(id: string) {
  return await db.transaction(async (tx) => {
    const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, id)).limit(1);
    if (!batch) {
      throw new Error("بچ تولید مورد نظر یافت نشد.");
    }

    const items = await tx.select().from(productionBatchItems).where(eq(productionBatchItems.batchId, id));

    await recordInventoryTransaction(
      {
        itemType: "product",
        itemId: batch.productId,
        transactionType: "adjustment",
        quantityChange: -Number(batch.quantityProduced),
        unitCostSnapshot: Number(batch.unitCost),
        referenceType: "production_batch_void",
        referenceId: batch.id,
        projectId: batch.projectId || null,
        notes: `ابطال بچ تولید #${batch.batchNumber}`,
        allowNegativeStock: true,
      },
      tx
    );

    for (const item of items) {
      await recordInventoryTransaction(
        {
          itemType: "raw_material",
          itemId: item.rawMaterialId,
          transactionType: "adjustment",
          quantityChange: Number(item.quantityConsumed),
          unitCostSnapshot: Number(item.unitCostSnapshot),
          referenceType: "production_batch_void",
          referenceId: batch.id,
          projectId: batch.projectId || null,
          notes: `بازگشت مواد اولیه حاصل از ابطال بچ #${batch.batchNumber}`,
          allowNegativeStock: true,
        },
        tx
      );
    }

    await tx.delete(productionBatchItems).where(eq(productionBatchItems.batchId, id));
    await tx.delete(productionBatches).where(eq(productionBatches.id, id));

    await logAuditEvent("DELETE", "production_batch", id, {
      batchNumber: batch.batchNumber,
      quantityProduced: batch.quantityProduced,
    });

    return { success: true, message: `بچ تولید #${batch.batchNumber} با موفقیت ابطال و حذف گردید.` };
  });
}
