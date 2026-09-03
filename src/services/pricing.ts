import { db } from "@/db";
import { products, projectProductPrices, productRecipes, rawMaterials } from "@/db/schema";
import { eq, and, desc, lte, gte, or, isNull } from "drizzle-orm";

export interface ResolvedPriceResult {
  productId: string;
  projectId?: string | null;
  basePrice: number;
  projectPrice: number | null;
  effectivePrice: number;
  priceSource: "project_override" | "base_price";
}

/**
 * Resolves product price for a specific project context.
 * PROMPT FIX B: Look up existing project price strictly matching BOTH projectId AND productId.
 */
export async function resolveProductPrice(
  productId: string,
  projectId?: string | null
): Promise<ResolvedPriceResult> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const basePrice = Number(product.basePrice) || 0;

  if (!projectId) {
    return {
      productId,
      projectId: null,
      basePrice,
      projectPrice: null,
      effectivePrice: basePrice,
      priceSource: "base_price",
    };
  }

  // Strictly check both projectId AND productId
  const [projectPriceRecord] = await db
    .select()
    .from(projectProductPrices)
    .where(and(
      eq(projectProductPrices.projectId, projectId),
      eq(projectProductPrices.productId, productId),
      or(isNull(projectProductPrices.effectiveStartDate), lte(projectProductPrices.effectiveStartDate, new Date())),
      or(isNull(projectProductPrices.effectiveEndDate), gte(projectProductPrices.effectiveEndDate, new Date()))
    ))
    .orderBy(desc(projectProductPrices.effectiveStartDate), desc(projectProductPrices.updatedAt))
    .limit(1);

  if (projectPriceRecord && projectPriceRecord.customPrice !== null) {
    const customPrice = Number(projectPriceRecord.customPrice);
    return {
      productId,
      projectId,
      basePrice,
      projectPrice: customPrice,
      effectivePrice: customPrice,
      priceSource: "project_override",
    };
  }

  return {
    productId,
    projectId,
    basePrice,
    projectPrice: null,
    effectivePrice: basePrice,
    priceSource: "base_price",
  };
}

/**
 * Calculates current BOM cost for a product based on raw materials
 */
export async function calculateProductBOMCost(productId: string): Promise<number> {
  const recipes = await db
    .select({
      quantityRequired: productRecipes.quantityRequired,
      wastagePercent: productRecipes.wastagePercent,
      currentCost: rawMaterials.currentCost,
      averageCost: rawMaterials.averageCost,
      costPolicy: rawMaterials.costPolicy,
    })
    .from(productRecipes)
    .innerJoin(rawMaterials, eq(productRecipes.rawMaterialId, rawMaterials.id))
    .where(eq(productRecipes.productId, productId));

  let totalCost = 0;
  for (const r of recipes) {
    const qty = Number(r.quantityRequired) || 0;
    const wastage = (Number(r.wastagePercent) || 0) / 100;
    const unitCost = r.costPolicy === "average" ? Number(r.averageCost) : Number(r.currentCost);
    const itemCost = qty * (1 + wastage) * unitCost;
    totalCost += itemCost;
  }

  return Math.round(totalCost * 100) / 100;
}

/**
 * Updates a product's calculated cost in DB based on its raw material BOM
 */
export async function updateProductCostFromBOM(productId: string): Promise<number> {
  const bomCost = await calculateProductBOMCost(productId);
  await db
    .update(products)
    .set({
      calculatedCost: bomCost.toString(),
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));

  return bomCost;
}

/**
 * Inflation What-If Simulator:
 * Given raw material price change percentages (e.g. { rawMaterialId: +15 }),
 * calculates impact on product COGS, margin, and recommended price.
 */
export async function simulateInflationImpact(changes: Record<string, number>) {
  const allProducts = await db.select().from(products);
  const allRawMaterials = await db.select().from(rawMaterials);

  const rawMaterialMap = new Map(allRawMaterials.map((rm) => [rm.id, rm]));

  const results = [];

  for (const product of allProducts) {
    const recipes = await db
      .select()
      .from(productRecipes)
      .where(eq(productRecipes.productId, product.id));

    let oldCogs = Number(product.calculatedCost) || 0;
    let newCogs = 0;

    for (const r of recipes) {
      const rm = rawMaterialMap.get(r.rawMaterialId);
      if (!rm) continue;

      const currentCost = Number(rm.currentCost) || 0;
      const changePct = changes[rm.id] || 0;
      const simulatedRmCost = currentCost * (1 + changePct / 100);

      const qty = Number(r.quantityRequired) || 0;
      const wastage = (Number(r.wastagePercent) || 0) / 100;
      newCogs += qty * (1 + wastage) * simulatedRmCost;
    }

    if (recipes.length === 0) {
      newCogs = oldCogs;
    }

    const currentBasePrice = Number(product.basePrice) || 0;
    const oldMargin = currentBasePrice > 0 ? ((currentBasePrice - oldCogs) / currentBasePrice) * 100 : 0;
    const newMargin = currentBasePrice > 0 ? ((currentBasePrice - newCogs) / currentBasePrice) * 100 : 0;
    const marginCompressionPct = oldMargin - newMargin;

    // Recommended price to maintain original margin percentage
    const recommendedPrice = oldMargin < 100 ? Math.round((newCogs / (1 - oldMargin / 100)) * 100) / 100 : Math.round(newCogs * 1.3);

    results.push({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      currentPrice: currentBasePrice,
      oldCogs,
      newCogs: Math.round(newCogs * 100) / 100,
      cogsIncreasePercent: oldCogs > 0 ? Math.round(((newCogs - oldCogs) / oldCogs) * 10000) / 100 : 0,
      oldMarginPercent: Math.round(oldMargin * 100) / 100,
      newMarginPercent: Math.round(newMargin * 100) / 100,
      marginCompressionPct: Math.round(marginCompressionPct * 100) / 100,
      recommendedPrice,
    });
  }

  return results;
}
