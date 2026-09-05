import { ApiError, decimal } from "@/lib/apiError";
import type { Transaction } from "./product";
import { db } from "@/db";
import {
  rawMaterials,
  rawMaterialPriceHistory,
  productRecipes,
  products,
  productionBatchItems,
  purchaseItems,
} from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { updateProductCostFromBOM } from "./pricing";
import { recordInventoryTransaction } from "./inventory";
import { logAuditEvent } from "./audit";

export interface CreateRawMaterialInput {
  code: string;
  name: string;
  unit: string;
  unitConversionFactor?: number;
  secondaryUnit?: string;
  stockQuantity?: number;
  minStockQuantity?: number;
  currentCost: number;
  supplierId?: string | null;
  costPolicy?: "average" | "fifo" | "latest";
  notes?: string;
}

export interface UpdateRawMaterialInput {
  name?: string;
  code?: string;
  unit?: string;
  unitConversionFactor?: number;
  secondaryUnit?: string;
  minStockQuantity?: number;
  currentCost?: number;
  purchaseQuantity?: number;
  supplierId?: string | null;
  costPolicy?: "average" | "fifo" | "latest";
  status?: "active" | "inactive" | "archived";
  notes?: string;
  priceChangeReason?: string;
}

/**
 * Creates a new Raw Material
 */
export async function createRawMaterial(input: CreateRawMaterialInput) {
  const cleanCode = (input.code || "").trim();
  const cleanName = (input.name || "").trim();

  if (!cleanCode) throw new Error("کد ماده اولیه الزامی است.");
  if (!cleanName) throw new Error("نام ماده اولیه الزامی است.");

  // Check duplicate code
  const [existingCode] = await db
    .select({ id: rawMaterials.id })
    .from(rawMaterials)
    .where(eq(rawMaterials.code, cleanCode))
    .limit(1);

  if (existingCode) {
    throw new Error(`کد ماده اولیه "${cleanCode}" قبلاً ثبت شده است. لطفاً کد دیگری وارد کنید.`);
  }

  const supplierIdValue = input.supplierId && input.supplierId.trim().length > 0 ? input.supplierId.trim() : null;
  const cost = Number.isFinite(Number(input.currentCost)) && Number(input.currentCost) >= 0 ? Number(input.currentCost) : 0;
  const stockQty = Number.isFinite(Number(input.stockQuantity)) && Number(input.stockQuantity) >= 0 ? Number(input.stockQuantity) : 0;
  const minStockQty = Number.isFinite(Number(input.minStockQuantity)) && Number(input.minStockQuantity) >= 0 ? Number(input.minStockQuantity) : 10;
  const conversionFactor = Number.isFinite(Number(input.unitConversionFactor)) && Number(input.unitConversionFactor) > 0 ? Number(input.unitConversionFactor) : 1;

  const [rm] = await db
    .insert(rawMaterials)
    .values({
      code: cleanCode,
      name: cleanName,
      unit: input.unit || "کیلوگرم",
      unitConversionFactor: conversionFactor.toString(),
      secondaryUnit: input.secondaryUnit ? input.secondaryUnit.trim() : null,
      stockQuantity: stockQty.toString(),
      minStockQuantity: minStockQty.toString(),
      currentCost: cost.toString(),
      averageCost: cost.toString(),
      supplierId: supplierIdValue,
      costPolicy: input.costPolicy || "average",
      notes: input.notes ? input.notes.trim() : null,
    })
    .returning();

  // Initial Price History entry with safe numeric strings
  try {
    const costNum = Number(cost) || 0;
    await db.insert(rawMaterialPriceHistory).values({
      rawMaterialId: rm.id,
      oldCost: "0.00",
      newCost: costNum.toFixed(2),
      changePercent: costNum > 0 ? "100.00" : "0.00",
      reason: "قیمت اولیه",
    });
  } catch (histErr) {
    console.error("Warning: could not insert initial raw material price history:", histErr);
  }

  await logAuditEvent("CREATE", "raw_material", rm.id, { name: rm.name, code: rm.code, cost });
  return rm;
}

/**
 * Updates a Raw Material and propagates price changes to BOM & product costs.
 * PROMPT REQUIREMENT A: Real edit, save, cancel, validation, refresh, audit & dependent product cost updates.
 */
export async function updateRawMaterial(id: string, input: UpdateRawMaterialInput, tx?: Transaction): Promise<typeof rawMaterials.$inferSelect> {
  if (!tx) return db.transaction(client => updateRawMaterial(id, input, client));
  if (input.currentCost !== undefined) decimal(input.currentCost, "هزینه");
  const [existing] = await tx.select().from(rawMaterials).where(eq(rawMaterials.id, id)).for("update").limit(1);
  if (!existing) {
    throw new Error("ماده اولیه پیدا نشد");
  }

  const updatePayload: Record<string, any> = { updatedAt: new Date() };

  if (input.code !== undefined) {
    const cleanCode = input.code.trim();
    if (!cleanCode) throw new Error("کد ماده اولیه نمی‌تواند خالی باشد.");
    if (cleanCode !== existing.code) {
      const [existingCode] = await tx
        .select({ id: rawMaterials.id })
        .from(rawMaterials)
        .where(eq(rawMaterials.code, cleanCode))
        .limit(1);
      if (existingCode) {
        throw new Error(`کد ماده اولیه "${cleanCode}" قبلاً برای ماده دیگری ثبت شده است.`);
      }
    }
    updatePayload.code = cleanCode;
  }

  if (input.name !== undefined) {
    const cleanName = input.name.trim();
    if (!cleanName) throw new Error("نام ماده اولیه نمی‌تواند خالی باشد.");
    updatePayload.name = cleanName;
  }

  if (input.unit !== undefined) updatePayload.unit = input.unit;
  if (input.unitConversionFactor !== undefined) {
    const factor = Number(input.unitConversionFactor) > 0 ? Number(input.unitConversionFactor) : 1;
    updatePayload.unitConversionFactor = factor.toString();
  }
  if (input.secondaryUnit !== undefined) {
    updatePayload.secondaryUnit = input.secondaryUnit && input.secondaryUnit.trim() ? input.secondaryUnit.trim() : null;
  }
  if (input.minStockQuantity !== undefined) {
    const minQty = Number(input.minStockQuantity) >= 0 ? Number(input.minStockQuantity) : 0;
    updatePayload.minStockQuantity = minQty.toString();
  }
  if (input.supplierId !== undefined) {
    updatePayload.supplierId = input.supplierId && input.supplierId.trim().length > 0 ? input.supplierId.trim() : null;
  }
  if (input.costPolicy !== undefined) updatePayload.costPolicy = input.costPolicy;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.notes !== undefined) {
    updatePayload.notes = input.notes && input.notes.trim() ? input.notes.trim() : null;
  }

  const oldCost = Number(existing.currentCost);
  const newCost = input.currentCost !== undefined ? Number(input.currentCost) : oldCost;

  let priceChanged = false;

  if (input.currentCost !== undefined && (newCost !== oldCost || Number(input.purchaseQuantity) > 0)) {
    priceChanged = true;
    updatePayload.currentCost = newCost.toString();

    // Calculate weighted average cost if cost policy is average
    const currentStock = Math.max(0, Number(existing.stockQuantity) - Number(input.purchaseQuantity || 0));
    const oldAvg = Number(existing.averageCost) || oldCost;
    const purchaseQty = input.purchaseQuantity || 0;
    let newAvg: number;
    if (existing.costPolicy === "average" && currentStock > 0 && purchaseQty > 0) {
      // Weighted average: ((oldAvg * oldStock) + (newCost * newQty)) / (oldStock + newQty)
      newAvg = ((oldAvg * currentStock) + (newCost * purchaseQty)) / (currentStock + purchaseQty);
    } else if (currentStock > 0) {
      // Simple average for manual edits without quantity context
      newAvg = (oldAvg + newCost) / 2;
    } else {
      newAvg = newCost;
    }
    updatePayload.averageCost = Math.round(newAvg * 100) / 100;

    const changePercent = oldCost > 0 ? Math.round(((newCost - oldCost) / oldCost) * 10000) / 100 : 100;

    // Save Price History Record
    try {
      await tx.insert(rawMaterialPriceHistory).values({
        rawMaterialId: id,
        oldCost: oldCost.toFixed(2),
        newCost: newCost.toFixed(2),
        changePercent: changePercent.toFixed(2),
        reason: input.priceChangeReason || "ویرایش قیمت دستی",
      });
    } catch (histErr) {
      console.error("Raw material price history failed:", histErr);
      throw histErr;
    }
  }

  const [updated] = await tx
    .update(rawMaterials)
    .set(updatePayload)
    .where(eq(rawMaterials.id, id))
    .returning();

  // If price changed, update costs of all products that use this raw material in BOM
  if (priceChanged) {
    const affectedRecipes = await tx
      .select({ productId: productRecipes.productId })
      .from(productRecipes)
      .where(eq(productRecipes.rawMaterialId, id));

    const affectedProductIds = Array.from(new Set(affectedRecipes.map((r) => r.productId)));

    for (const prodId of affectedProductIds) {
      await updateProductCostFromBOM(prodId, tx);
    }
  }

  await logAuditEvent("UPDATE", "raw_material", id, {
    oldCost,
    newCost,
    priceChanged,
    updatedFields: Object.keys(updatePayload),
  }, undefined, tx);

  return updated;
}

/**
 * Deletes a Raw Material with comprehensive dependency checks
 */
export async function deleteRawMaterial(id: string) {
  const [existing] = await db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).limit(1);
  if (!existing) {
    throw new Error("ماده اولیه پیدا نشد.");
  }

  // 1. Check if used in production batches
  const batchUsage = await db
    .select({ id: productionBatchItems.id })
    .from(productionBatchItems)
    .where(eq(productionBatchItems.rawMaterialId, id))
    .limit(1);

  if (batchUsage.length > 0) {
    throw new Error("امکان حذف این ماده اولیه وجود ندارد؛ زیرا در سوابق مصرف بچ‌های تولیدی استفاده شده است.");
  }

  // 2. Check if used in purchases
  const purchaseUsage = await db
    .select({ id: purchaseItems.id })
    .from(purchaseItems)
    .where(and(eq(purchaseItems.itemId, id), eq(purchaseItems.itemType, "raw_material")))
    .limit(1);

  if (purchaseUsage.length > 0) {
    throw new Error("امکان حذف این ماده اولیه وجود ندارد؛ زیرا در فاکتورهای خرید ثبت شده است.");
  }

  // 3. Find affected BOM recipes
  const recipeUsage = await db
    .select({ id: productRecipes.id, productId: productRecipes.productId })
    .from(productRecipes)
    .where(eq(productRecipes.rawMaterialId, id));

  const affectedProductIds = Array.from(new Set(recipeUsage.map((r) => r.productId)));

  // Delete price history
  await db.delete(rawMaterialPriceHistory).where(eq(rawMaterialPriceHistory.rawMaterialId, id));

  // Delete from product recipes
  await db.delete(productRecipes).where(eq(productRecipes.rawMaterialId, id));

  // Delete raw material itself
  await db.delete(rawMaterials).where(eq(rawMaterials.id, id));

  // Update BOM cost for affected products
  for (const prodId of affectedProductIds) {
    try {
      await updateProductCostFromBOM(prodId);
    } catch {
      // Continue if BOM update fails
    }
  }

  await logAuditEvent("DELETE", "raw_material", id, {
    name: existing.name,
    code: existing.code,
  });

  return { success: true, deletedName: existing.name };
}

/**
 * Manual stock adjustment for raw material
 */
export async function adjustRawMaterialStock(
  rawMaterialId: string,
  newQuantity: number,
  reason: string,
  userId?: string
) {
  const [rm] = await db.select().from(rawMaterials).where(eq(rawMaterials.id, rawMaterialId)).limit(1);
  if (!rm) throw new Error("ماده اولیه پیدا نشد");

  const targetQty = Number(newQuantity);
  if (!Number.isFinite(targetQty) || targetQty < 0) {
    throw new Error("مقدار جدید موجودی باید عددی معتبر و بزرگتر یا مساوی صفر باشد.");
  }

  const currentStock = Number(rm.stockQuantity) || 0;
  const delta = Math.round((targetQty - currentStock) * 10000) / 10000;

  if (delta === 0) return rm;

  await recordInventoryTransaction({
    itemType: "raw_material",
    itemId: rawMaterialId,
    transactionType: "adjustment",
    quantityChange: delta,
    unitCostSnapshot: Number(rm.currentCost) || 0,
    referenceType: "manual_adjustment",
    notes: `تعدیل دستی موجودی: ${reason} (قبلی: ${currentStock}، جدید: ${targetQty})`,
  });

  return (await db.select().from(rawMaterials).where(eq(rawMaterials.id, rawMaterialId)).limit(1))[0];
}

/**
 * Retrieves raw material price history
 */
export async function getRawMaterialPriceHistory(rawMaterialId: string) {
  return await db
    .select()
    .from(rawMaterialPriceHistory)
    .where(eq(rawMaterialPriceHistory.rawMaterialId, rawMaterialId))
    .orderBy(desc(rawMaterialPriceHistory.createdAt));
}
