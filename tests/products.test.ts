import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PgDialect, getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { GET as projectList, POST as createProject } from "../src/app/api/projects/route";
import { POST as createExpense } from "../src/app/api/expenses/route";
const state = vi.hoisted(() => ({ db: null as unknown, permission: "allow" }));
vi.mock("@/db", () => ({ get db() { return state.db; }, pool: {} }));
vi.mock("@/services/access", async () => {
  const { ApiError } = await import("../src/lib/apiError");
  return { requirePermission: vi.fn(async () => {
    if (state.permission === "anonymous") throw new ApiError(401, "ابتدا وارد شوید");
    if (state.permission === "denied") throw new ApiError(403, "دسترسی مجاز نیست");
    return { employeeId: randomUUID(), permissions: new Set(["*"]) };
  }) };
});
import * as schema from "../src/db/schema";
import { migrateDatabase } from "../src/db/migrate";
import { products, productRecipes, rawMaterials, projectProductPrices, projects, customers, invoices, invoiceItems, productionBatches, commissionRules, consignmentItems, inventoryLedger, purchaseItems, warehouses, consignments, purchases, suppliers } from "../src/db/schema";
import { DELETE, PUT } from "../src/app/api/products/[id]/route";
import { POST, GET } from "../src/app/api/products/route";
import { DELETE as deleteSpecial } from "../src/app/api/special-products/[id]/route";
import { createInvoice, reverseInvoice, updateInvoice } from "../src/services/invoice";
import { productInput } from "../src/services/product";
const pg = new PGlite();
const database = drizzle(pg);
const dialect = new PgDialect();
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (body: unknown, method = "POST") => new Request("http://localhost/api/products", { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const create = async (special = false) => (await database.insert(products).values({ code: randomUUID(), name: "محصول آزمایشی", basePrice: "100", isSpecial: special }).returning())[0];

beforeAll(async () => {
  // PostgreSQL WASM does not need the pgcrypto extension for gen_random_uuid.
  state.db = { execute: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
    const { sql } = dialect.sqlToQuery(query);
    return pg.exec(sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', ""));
  } };
  await migrateDatabase();
  await migrateDatabase(); // Re-running startup migrations must retain data and succeed.
  state.db = database;
}, 60000);
afterAll(async () => { await pg.close(); });

describe("Production product lifecycle against PostgreSQL", () => {
  it("has no legacy required columns that block current ORM inserts", async () => {
    const blocking: string[] = [];
    for (const table of Object.values(schema)) {
      if (!(table instanceof PgTable)) continue;
      const config = getTableConfig(table);
      const known = new Set(config.columns.map(column => column.name));
      const actual = await pg.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1", [config.name]);
      const actualNames = new Set(actual.rows.map(row => row.column_name));
      for (const column of known) if (!actualNames.has(column)) blocking.push(`missing: ${config.name}.${column}`);
      const result = await pg.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND is_nullable = 'NO' AND column_default IS NULL", [config.name]);
      for (const row of result.rows) if (!known.has(row.column_name)) blocking.push(`${config.name}.${row.column_name}`);
    }
    expect(blocking).toEqual([]);
  });
  it("does not swallow access denials in project and expense APIs", async () => {
    state.permission = "denied";
    expect((await projectList()).status).toBe(403);
    expect((await createProject(request({ name: "test" }))).status).toBe(403);
    expect((await createExpense(request({ title: "test", amount: 1 }))).status).toBe(403);
    state.permission = "allow";
  });
  it("creates valid products and rejects incomplete/invalid prices", async () => {
    for (const body of [{}, { name: "x", basePrice: -1 }, { name: "x", basePrice: "bad" }, { name: "x", basePrice: null }]) expect((await POST(request(body))).status).toBe(400);
    const res = await POST(request({ name: "جدید", basePrice: 100, code: randomUUID() }));
    expect(res.status).toBe(201);
  });
  it("updates price, stock and details, and rejects invalid changes", async () => {
    const p = await create();
    expect((await PUT(request({ name: "ویرایش", basePrice: 200, stockQuantity: 5 }, "PUT"), params(p.id))).status).toBe(200);
    const [updated] = await database.select().from(products).where(eq(products.id, p.id));
    expect(updated.name).toBe("ویرایش"); expect(Number(updated.basePrice)).toBe(200); expect(Number(updated.stockQuantity)).toBe(5);
    expect((await PUT(request({ basePrice: "NaN" }, "PUT"), params(p.id))).status).toBe(400);
  });
  it("deletes an unused product and safe recipe/price settings", async () => {
    const p = await create();
    const [rm] = await database.insert(rawMaterials).values({ code: randomUUID(), name: "ماده" }).returning();
    const [project] = await database.insert(projects).values({ code: randomUUID(), name: "پروژه" }).returning();
    await database.insert(productRecipes).values({ productId: p.id, rawMaterialId: rm.id, quantityRequired: "1" });
    await database.insert(projectProductPrices).values({ productId: p.id, projectId: project.id, customPrice: "10" });
    const result = await DELETE(new Request("http://localhost"), params(p.id));
    expect(result.status).toBe(200); expect((await result.json()).archived).toBe(false);
    expect(await database.select().from(products).where(eq(products.id, p.id))).toHaveLength(0);
    expect(await database.select().from(rawMaterials).where(eq(rawMaterials.id, rm.id))).toHaveLength(1);
  });
  it("archives an invoiced product and preserves exact financial snapshots", async () => {
    const p = await create();
    const [c] = await database.insert(customers).values({ code: randomUUID(), name: "مشتری", mobile: "09123456789" }).returning();
    const [inv] = await database.insert(invoices).values({ invoiceNumber: randomUUID(), customerId: c.id, grandTotal: "100" }).returning();
    const [line] = await database.insert(invoiceItems).values({ invoiceId: inv.id, productId: p.id, productNameSnapshot: p.name, quantity: "1", unitPrice: "100", lineTotal: "100" }).returning();
    await expect(database.delete(products).where(eq(products.id, p.id))).rejects.toThrow(); // Reproduce original FK failure.
    const result = await DELETE(new Request("http://localhost"), params(p.id));
    expect(result.status).toBe(200); expect((await result.json()).archived).toBe(true);
    expect((await database.select().from(invoiceItems).where(eq(invoiceItems.id, line.id)))[0]).toEqual(line);
    expect((await database.select().from(invoices).where(eq(invoices.id, inv.id)))[0]).toEqual(inv);
    const list = await (await GET(new Request("http://localhost/api/products"))).json();
    expect(list.products.some((row: { id: string }) => row.id === p.id)).toBe(false);
  });
  it("archives products with production and commission dependencies", async () => {
    for (const relation of ["production", "commission"]) {
      const p = await create();
      if (relation === "production") await database.insert(productionBatches).values({ productId: p.id, batchNumber: randomUUID(), quantityProduced: "1" });
      else await database.insert(commissionRules).values({ productId: p.id, name: "قاعده", rateValue: "5" });
      const res = await DELETE(new Request("http://localhost"), params(p.id));
      expect(res.status).toBe(200); expect((await res.json()).archived).toBe(true);
    }
  });

  it("preserves purchase, consignment and polymorphic inventory history", async () => {
    const [customer] = await database.insert(customers).values({ code: randomUUID(), name: "مشتری", mobile: "09123456789" }).returning();
    const [warehouse] = await database.insert(warehouses).values({ code: randomUUID(), name: "انبار" }).returning();
    const [supplier] = await database.insert(suppliers).values({ code: randomUUID(), name: "تامین‌کننده", mobile: "09123456789" }).returning();
    const [purchase] = await database.insert(purchases).values({ purchaseNumber: randomUUID(), supplierId: supplier.id }).returning();
    const [consignment] = await database.insert(consignments).values({ consignmentNumber: randomUUID(), customerId: customer.id }).returning();
    for (const relation of ["purchase", "inventory", "consignment"]) {
      const p = await create();
      if (relation === "purchase") await database.insert(purchaseItems).values({ purchaseId: purchase.id, itemId: p.id, itemType: "product", unit: "عدد", quantity: "1", unitCost: "10", totalCost: "10" });
      if (relation === "inventory") await database.insert(inventoryLedger).values({ warehouseId: warehouse.id, itemId: p.id, itemType: "product", transactionType: "adjustment", quantityChange: "1", quantityBefore: "0", quantityAfter: "1" });
      if (relation === "consignment") await database.insert(consignmentItems).values({ consignmentId: consignment.id, productId: p.id, quantityDelivered: "1", unitPrice: "10" });
      const res = await DELETE(new Request("http://localhost"), params(p.id));
      expect(res.status).toBe(200); expect((await res.json()).archived).toBe(true);
    }
  });
  it("keeps invoice snapshots stable and makes retries idempotent", async () => {
    const p = await create();
    await database.update(products).set({ stockQuantity: "10" }).where(eq(products.id, p.id));
    const [c] = await database.insert(customers).values({ code: randomUUID(), name: "مشتری", mobile: "09123456789" }).returning();
    const input = { customerId: c.id, items: [{ productId: p.id, quantity: 2, unitPrice: 100 }], requestKey: randomUUID(), requestHash: "same" };
    const first = await createInvoice(input);
    const repeated = await createInvoice(input);
    expect(repeated.id).toBe(first.id);
    expect(Number((await database.select().from(products).where(eq(products.id, p.id)))[0].stockQuantity)).toBe(8);
    await expect(createInvoice({ ...input, requestHash: "different" })).rejects.toThrow();
    await database.update(products).set({ basePrice: "999" }).where(eq(products.id, p.id));
    expect(Number((await database.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, first.id)))[0].unitPrice)).toBe(100);
    await updateInvoice(first.id, { invoiceDiscount: 10 });
    expect(Number((await database.select().from(invoices).where(eq(invoices.id, first.id)))[0].grandTotal)).toBe(190);
    await reverseInvoice(first.id, "تست");
    await expect(reverseInvoice(first.id, "تکرار")).rejects.toThrow();
    expect(Number((await database.select().from(products).where(eq(products.id, p.id)))[0].stockQuantity)).toBe(10);
    await expect(updateInvoice(first.id, { invoiceDiscount: 20 })).rejects.toThrow();
  });
  it("returns 400/404/401/403 without raw database errors", async () => {
    expect((await DELETE(new Request("http://localhost"), params("bad"))).status).toBe(400);
    expect((await DELETE(new Request("http://localhost"), params(randomUUID()))).status).toBe(404);
    const p = await create();
    for (const [permission, status] of [["anonymous", 401], ["denied", 403]] as const) {
      state.permission = permission;
      expect((await DELETE(new Request("http://localhost"), params(p.id))).status).toBe(status);
      expect((await deleteSpecial(new Request("http://localhost") as never, params(p.id))).status).toBe(status);
    }
    state.permission = "allow";
    expect(await database.select().from(products).where(eq(products.id, p.id))).toHaveLength(1);
  });
  it("rolls back product creation when a recipe references a missing material", async () => {
    const code = randomUUID();
    const res = await POST(request({ name: "نامعتبر", code, basePrice: 50, recipes: [{ rawMaterialId: randomUUID(), quantityRequired: 1 }] }));
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).not.toMatch(/Failed query|insert into|constraint/);
    expect(await database.select().from(products).where(eq(products.code, code))).toHaveLength(0);
  });
});
