import { db } from "@/db";
import { inventoryLedger, products, rawMaterials, warehouses } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "./audit";

export interface InventoryTransactionInput {
  warehouseId?: string;
  itemType: "product" | "raw_material";
  itemId: string;
  transactionType:
    | "purchase"
    | "sale"
    | "sales_return"
    | "production_input"
    | "production_output"
    | "adjustment"
    | "transfer"
    | "damage"
    | "consignment_out"
    | "consignment_return";
  quantityChange: number;
  unitCostSnapshot?: number;
  referenceType?: string;
  referenceId?: string;
  projectId?: string | null;
  notes?: string;
  allowNegativeStock?: boolean;
}

export async function getDefaultWarehouseId(
  type: "central" | "raw_materials" | "finished_goods" = "central",
  tx?: any
): Promise<string> {
  const client = tx || db;
  const [existing] = await client
    .select()
    .from(warehouses)
    .where(eq(warehouses.type, type))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await client
    .insert(warehouses)
    .values({
      code: `WH-${type.toUpperCase()}`,
      name: type === "raw_materials" ? "انبار مواد اولیه" : type === "finished_goods" ? "انبار محصولات نهایی" : "انبار مرکزی",
      type,
      isDefault: true,
    })
    .returning();

  return created.id;
}

/**
 * Records an inventory transaction with FOR UPDATE row locking to prevent race conditions.
 */
export async function recordInventoryTransaction(input: InventoryTransactionInput, tx?: any) {
  const client = tx || db;
  const warehouseId =
    input.warehouseId ||
    (await getDefaultWarehouseId(input.itemType === "raw_material" ? "raw_materials" : "finished_goods", client));

  let currentStock = 0;
  let currentCost = 0;

  if (input.itemType === "product") {
    const [prod] = await client
      .select()
      .from(products)
      .where(eq(products.id, input.itemId))
      .for("update")
      .limit(1);
    if (!prod) throw new Error(`محصول یافت نشد: ${input.itemId}`);
    currentStock = Number(prod.stockQuantity) || 0;
    currentCost = Number(prod.calculatedCost) || Number(prod.basePrice) || 0;
  } else {
    const [rm] = await client
      .select()
      .from(rawMaterials)
      .where(eq(rawMaterials.id, input.itemId))
      .for("update")
      .limit(1);
    if (!rm) throw new Error(`ماده اولیه یافت نشد: ${input.itemId}`);
    currentStock = Number(rm.stockQuantity) || 0;
    currentCost = Number(rm.averageCost) || Number(rm.currentCost) || 0;
  }

  const change = input.quantityChange;
  const newStock = Math.round((currentStock + change) * 10000) / 10000;

  if (change < 0 && newStock < 0 && !input.allowNegativeStock) {
    const itemName =
      input.itemType === "product"
        ? (await client.select({ name: products.name }).from(products).where(eq(products.id, input.itemId)))[0]?.name
        : (await client.select({ name: rawMaterials.name }).from(rawMaterials).where(eq(rawMaterials.id, input.itemId)))[0]?.name;

    throw new Error(
      `موجودی ناکافی برای آیتم "${itemName || input.itemId}". موجودی فعلی: ${currentStock}، مقدار مورد نیاز: ${Math.abs(change)}.`
    );
  }

  const unitCost = input.unitCostSnapshot !== undefined ? input.unitCostSnapshot : currentCost;
  const totalCost = Math.round(Math.abs(change) * unitCost * 100) / 100;

  const [ledgerEntry] = await client
    .insert(inventoryLedger)
    .values({
      warehouseId,
      itemType: input.itemType,
      itemId: input.itemId,
      transactionType: input.transactionType,
      quantityChange: change.toString(),
      quantityBefore: currentStock.toString(),
      quantityAfter: newStock.toString(),
      unitCostSnapshot: unitCost.toString(),
      totalCostSnapshot: totalCost.toString(),
      referenceType: input.referenceType || null,
      referenceId: input.referenceId || null,
      projectId: input.projectId || null,
      notes: input.notes || null,
    })
    .returning();

  if (input.itemType === "product") {
    await client
      .update(products)
      .set({ stockQuantity: newStock.toString(), updatedAt: new Date() })
      .where(eq(products.id, input.itemId));
  } else {
    await client
      .update(rawMaterials)
      .set({ stockQuantity: newStock.toString(), updatedAt: new Date() })
      .where(eq(rawMaterials.id, input.itemId));
  }

  await logAuditEvent("INVENTORY_TRANSACTION", input.itemType, input.itemId, {
    transactionType: input.transactionType,
    quantityChange: change,
    stockBefore: currentStock,
    stockAfter: newStock,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
  });

  return ledgerEntry;
}
