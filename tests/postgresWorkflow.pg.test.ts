import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { migrateDatabase } from "../src/db/migrate";
import { customers, inventoryLedger, invoiceItems, invoices, orderItems, orders, payments, productRecipes, products, productionBatches, rawMaterials } from "../src/db/schema";
import { createOrder, convertOrderToInvoice } from "../src/services/order";
import { executeProductionBatch } from "../src/services/production";

describe.skipIf(!process.env.TEST_DATABASE_URL)("real PostgreSQL workflows", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("hekmat_test")) throw new Error("Only a dedicated test database is allowed.");
    await migrateDatabase();
    await migrateDatabase();
  }, 90000);
  afterAll(async () => { await pool.end(); });

  it("keeps a proforma financially inert and converts it once with a manual charge", async () => {
    const [customer] = await db.insert(customers).values({ code: randomUUID(), name: "مشتری تست", mobile: "09120000000" }).returning();
    const [product] = await db.insert(products).values({ code: randomUUID(), name: "محصول تست", basePrice: "100", stockQuantity: "10" }).returning();
    const order = await createOrder({ customerId: customer.id, items: [
      { productId: product.id, quantity: 2, unitPrice: 100, discountAmount: 10 },
      { productName: "هزینه ارسال", quantity: 1, unitPrice: 25 },
    ], invoiceDiscount: 5 });
    const [stockBefore] = await db.select({ stock: products.stockQuantity }).from(products).where(eq(products.id, product.id));
    expect(stockBefore.stock).toBe("10.0000");
    expect(await db.select().from(inventoryLedger).where(eq(inventoryLedger.itemId, product.id))).toHaveLength(0);
    expect(await db.select().from(invoices).where(eq(invoices.customerId, customer.id))).toHaveLength(0);
    expect(await db.select().from(payments).where(eq(payments.customerId, customer.id))).toHaveLength(0);
    expect(await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))).toHaveLength(2);

    const result = await convertOrderToInvoice(order.id, "integration-test");
    expect(Number(result.grandTotal)).toBe(210);
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, result.id));
    expect(items.find((item) => item.isCustom)?.productNameSnapshot).toBe("هزینه ارسال");
    const [stockAfter] = await db.select({ stock: products.stockQuantity }).from(products).where(eq(products.id, product.id));
    expect(stockAfter.stock).toBe("8.0000");
    await expect(convertOrderToInvoice(order.id, "integration-test")).rejects.toThrow();
    expect(await db.select().from(invoices).where(eq(invoices.customerId, customer.id))).toHaveLength(1);
  }, 30000);

  it("returns every shortage, rolls back, and serializes competing batches", async () => {
    const [product] = await db.insert(products).values({ code: randomUUID(), name: "ساخت آزمایشی", basePrice: "100" }).returning();
    const [first, second] = await db.insert(rawMaterials).values([
      { code: randomUUID(), name: "ماده الف", stockQuantity: "3" },
      { code: randomUUID(), name: "ماده ب", stockQuantity: "1" },
    ]).returning();
    await db.insert(productRecipes).values([
      { productId: product.id, rawMaterialId: first.id, quantityRequired: "1" },
      { productId: product.id, rawMaterialId: first.id, quantityRequired: "0.5" },
      { productId: product.id, rawMaterialId: second.id, quantityRequired: "1" },
    ]);
    await expect(executeProductionBatch({ productId: product.id, quantityToProduce: 3 })).rejects.toMatchObject({
      code: "INSUFFICIENT_RAW_MATERIALS", shortages: expect.arrayContaining([
        expect.objectContaining({ materialId: first.id, shortage: "1.5000" }),
        expect.objectContaining({ materialId: second.id, shortage: "2.0000" }),
      ]),
    });
    expect(await db.select().from(productionBatches).where(eq(productionBatches.productId, product.id))).toHaveLength(0);
    expect(await db.select().from(inventoryLedger).where(eq(inventoryLedger.itemId, first.id))).toHaveLength(0);

    // Increase only the second material so two concurrent batches compete for the first.
    await db.update(rawMaterials).set({ stockQuantity: "2" }).where(eq(rawMaterials.id, second.id));
    const key = randomUUID();
    const attempts = await Promise.allSettled([
      executeProductionBatch({ productId: product.id, quantityToProduce: 1, requestKey: key, requestHash: "one" }),
      executeProductionBatch({ productId: product.id, quantityToProduce: 1, requestKey: randomUUID(), requestHash: "two" }),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    const batch = attempts[0].status === "fulfilled" ? attempts[0].value : null;
    const retry = await executeProductionBatch({ productId: product.id, quantityToProduce: 1, requestKey: key, requestHash: "one" });
    expect(retry.id).toBe(batch?.id);
    const [remaining] = await db.select({ stock: rawMaterials.stockQuantity }).from(rawMaterials).where(eq(rawMaterials.id, first.id));
    expect(Number(remaining.stock)).toBeGreaterThanOrEqual(0);
    expect(await db.select({ count: sql<number>`count(*)` }).from(productionBatches).where(eq(productionBatches.productId, product.id))).toMatchObject([{ count: "2" }]);
  }, 30000);
});
