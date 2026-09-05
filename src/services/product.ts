import { db } from "@/db";
import { products, productRecipes, projectProductPrices, invoiceItems, productionBatches, commissionRules, consignmentItems, inventoryLedger, purchaseItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ApiError, assertUuid, decimal } from "@/lib/apiError";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export function productInput(value: unknown, create = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "اطلاعات محصول معتبر نیست.");
  const body = value as Record<string, unknown>;
  const data: Partial<typeof products.$inferInsert> = {};
  for (const field of ["name", "code", "category", "unit", "imageUrl", "description", "notes"] as const) {
    if (body[field] === undefined) continue;
    if (body[field] === null && (field === "imageUrl" || field === "description" || field === "notes")) { data[field] = null; continue; }
    if (typeof body[field] !== "string") throw new ApiError(400, "متن اطلاعات محصول معتبر نیست.");
    const text = body[field].trim();
    if (["name", "category", "unit"].includes(field) && !text) throw new ApiError(400, "نام، دسته‌بندی و واحد نباید خالی باشد.");
    if (field === "code" && !text) continue;
    data[field] = text;
  }
  for (const field of ["basePrice", "calculatedCost", "stockQuantity", "minStockQuantity"] as const) {
    if (body[field] !== undefined) data[field] = decimal(body[field], "قیمت یا موجودی", field.includes("Quantity") ? 4 : 2);
  }
  if (body.status !== undefined) {
    if (!["active", "inactive", "archived"].includes(String(body.status))) throw new ApiError(400, "وضعیت محصول معتبر نیست.");
    data.status = String(body.status);
  }
  if (body.isSpecial !== undefined) {
    if (typeof body.isSpecial !== "boolean") throw new ApiError(400, "نوع محصول معتبر نیست.");
    data.isSpecial = body.isSpecial;
  }
  if (create && (!data.name || data.basePrice === undefined)) throw new ApiError(400, "نام و قیمت پایه محصول الزامی است.");
  let recipes: (typeof productRecipes.$inferInsert)[] | undefined;
  if (body.recipes !== undefined) {
    if (!Array.isArray(body.recipes)) throw new ApiError(400, "فرمول ساخت معتبر نیست.");
    const seen = new Set<string>();
    recipes = body.recipes.map((item: unknown) => {
      if (!item || typeof item !== "object") throw new ApiError(400, "فرمول ساخت معتبر نیست.");
      const r = item as Record<string, unknown>;
      assertUuid(r.rawMaterialId);
      if (seen.has(r.rawMaterialId)) throw new ApiError(400, "ماده اولیه تکراری است.");
      seen.add(r.rawMaterialId);
      const wastagePercent = decimal(r.wastagePercent ?? 0, "درصد ضایعات");
      if (Number(wastagePercent) > 100) throw new ApiError(400, "درصد ضایعات باید بین صفر و صد باشد.");
      return { productId: "", rawMaterialId: r.rawMaterialId, quantityRequired: decimal(r.quantityRequired, "مقدار ماده اولیه", 4, true), wastagePercent };
    });
  }
  return { data, recipes };
}

export async function deleteOrArchiveProduct(id: string, specialOnly = false) {
  assertUuid(id);
  return db.transaction(async (tx) => {
    const [product] = await tx.select().from(products).where(eq(products.id, id)).for("update").limit(1);
    if (!product || (specialOnly && !product.isSpecial)) throw new ApiError(404, "محصول یافت نشد.");
    // Lock the parent before inspecting dependencies. Historical and polymorphic
    // references are retained; no financial child records are removed.
    const references = [
      [invoiceItems, eq(invoiceItems.productId, id)],
      [productionBatches, eq(productionBatches.productId, id)],
      [commissionRules, eq(commissionRules.productId, id)],
      [consignmentItems, eq(consignmentItems.productId, id)],
      [inventoryLedger, and(eq(inventoryLedger.itemType, "product"), eq(inventoryLedger.itemId, id))],
      [purchaseItems, and(eq(purchaseItems.itemType, "product"), eq(purchaseItems.itemId, id))],
    ] as const;
    // Legacy special-product invoices stored only a code snapshot, without productId.
    const legacyItems = product.isSpecial ? await tx.select({ id: invoiceItems.id }).from(invoiceItems).where(eq(invoiceItems.customNotes, `[${product.code}]`)).limit(1) : [];
    let archive = product.status === "archived" || legacyItems.length > 0;
    for (const [table, condition] of references) {
      if ((await tx.select({ id: table.id }).from(table).where(condition).limit(1)).length) { archive = true; break; }
    }
    if (archive) {
      await tx.update(products).set({ status: "archived", updatedAt: new Date() }).where(eq(products.id, id));
    } else {
      // Recipe and per-project price settings have no independent financial history.
      await tx.delete(productRecipes).where(eq(productRecipes.productId, id));
      await tx.delete(projectProductPrices).where(eq(projectProductPrices.productId, id));
      await tx.delete(products).where(eq(products.id, id));
    }
    return { product, archived: archive, message: archive ? `محصول «${product.name}» بایگانی شد؛ سوابق مالی و فاکتورها حفظ شدند.` : `محصول «${product.name}» با موفقیت حذف شد.` };
  });
}
