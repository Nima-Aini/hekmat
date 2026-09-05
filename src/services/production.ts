import { ApiError, decimal } from "@/lib/apiError";
import { db } from "@/db";
import {
  productionBatches,
  productionBatchItems,
  productRecipes,
  rawMaterials,
  products,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordInventoryTransaction } from "./inventory";
import { logAuditEvent } from "./audit";

export interface CreateProductionBatchInput {
  productId: string;
  projectId?: string | null;
  quantityToProduce: number;
  laborCost?: number;
  overheadCost?: number;
  packagingCost?: number;
  notes?: string;
  allowInsufficientStock?: boolean;
}

/**
 * Executes a production batch process transactionally.
 */
export async function executeProductionBatch(input: CreateProductionBatchInput) {
  decimal(input.quantityToProduce, "مقدار تولید", 4, true);
  for (const amount of [input.laborCost, input.overheadCost, input.packagingCost]) decimal(amount ?? 0, "هزینه تولید");
  return await db.transaction(async (tx) => {
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
      throw new Error(`محصول "${product.name}" هیچ فرمول ساختی (BOM) تعریف شده ندارد.`);
    }

    const batchQty = input.quantityToProduce;
    if (batchQty <= 0) throw new Error("مقدار تولید باید بزرگتر از صفر باشد.");

    const materialRequirements = [];
    for (const r of recipes) {
      const qtyPerUnit = Number(r.quantityRequired) || 0;
      const wastage = (Number(r.wastagePercent) || 0) / 100;
      const totalQtyNeeded = Math.round(batchQty * qtyPerUnit * (1 + wastage) * 10000) / 10000;
      const stockAvailable = Number(r.currentStock) || 0;

      if (totalQtyNeeded > stockAvailable && !input.allowInsufficientStock) {
        throw new Error(
          `موجودی ماده اولیه "${r.rawMaterialName}" کافی نیست. مورد نیاز: ${totalQtyNeeded}، موجود در انبار: ${stockAvailable}.`
        );
      }

      const unitCost = r.costPolicy === "average" ? Number(r.averageCost) || Number(r.unitCost) : Number(r.unitCost);
      const lineCost = Math.round(totalQtyNeeded * unitCost * 100) / 100;

      materialRequirements.push({
        rawMaterialId: r.rawMaterialId,
        rawMaterialName: r.rawMaterialName,
        totalQtyNeeded,
        unitCost,
        lineCost,
      });
    }

    const batchNum = `BATCH-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
    let totalMaterialCost = 0;
    for (const m of materialRequirements) {
      totalMaterialCost += m.lineCost;
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
          rawMaterialId: m.rawMaterialId,
          quantityConsumed: m.totalQtyNeeded.toString(),
          unitCostSnapshot: m.unitCost.toString(),
          totalCostSnapshot: m.lineCost.toString(),
          wasteQuantity: "0",
        });
      } catch (insertErr: any) {
        console.error("Batch item insert error:", insertErr);
        throw new Error(`خطا در ثبت ردیف ماده اولیه "${m.rawMaterialName}": ${insertErr.message}`);
      }

      await recordInventoryTransaction(
        {
          itemType: "raw_material",
          itemId: m.rawMaterialId,
          transactionType: "production_input",
          quantityChange: -m.totalQtyNeeded,
          unitCostSnapshot: m.unitCost,
          referenceType: "production_batch",
          referenceId: createdBatch.id,
          projectId: input.projectId || null,
          notes: `مصرف در بچ تولید #${batchNum}`,
          allowNegativeStock: input.allowInsufficientStock,
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
    });

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
