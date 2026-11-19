export interface MaterialRequirementRow {
  rawMaterialId: string;
  rawMaterialName: string;
  code: string;
  unit: string;
  stock: string;
  quantityRequired: string;
  wastagePercent: string | null;
  unitCost: number;
}

const SCALE = BigInt(10000);
const fixed = (value: string | number, digits: number) => {
  const raw = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error("مقدار فرمول تولید نامعتبر است.");
  const [whole, fraction = ""] = raw.split(".");
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) throw new Error("دقت مقدار فرمول تولید نامعتبر است.");
  return BigInt(whole) * BigInt(10) ** BigInt(digits) + BigInt((fraction.slice(0, digits) + "0".repeat(digits)).slice(0, digits));
};
const asDecimal = (value: bigint) => `${value / SCALE}.${String(value % SCALE).padStart(4, "0")}`;

export function calculateProductionRequirements(rows: MaterialRequirementRow[], quantity: number) {
  const batch = fixed(quantity, 4);
  if (batch <= BigInt(0)) throw new Error("مقدار تولید باید بیشتر از صفر باشد.");
  const grouped = new Map<string, { materialId: string; materialName: string; code: string; unit: string; required: bigint; available: bigint; unitCost: number }>();
  for (const row of rows) {
    const perUnit = fixed(row.quantityRequired, 4);
    const wastage = fixed(row.wastagePercent ?? "0", 2);
    if (perUnit <= BigInt(0) || wastage < BigInt(0) || wastage > BigInt(10000)) throw new Error(`فرمول ماده اولیه «${row.rawMaterialName}» نامعتبر است.`);
    // Round upward to the inventory precision so consumption never understates the BOM.
    const numerator = batch * perUnit * (BigInt(10000) + wastage);
    const needed = (numerator + BigInt(100000000) - BigInt(1)) / BigInt(100000000);
    const current = grouped.get(row.rawMaterialId) ?? {
      materialId: row.rawMaterialId, materialName: row.rawMaterialName, code: row.code,
      unit: row.unit, required: BigInt(0), available: fixed(row.stock, 4), unitCost: row.unitCost,
    };
    current.required += needed;
    grouped.set(row.rawMaterialId, current);
  }
  const requirements = [...grouped.values()].map((row) => ({
    materialId: row.materialId, materialName: row.materialName, code: row.code, unit: row.unit,
    required: asDecimal(row.required), available: asDecimal(row.available),
    shortage: asDecimal(row.required > row.available ? row.required - row.available : BigInt(0)), unitCost: row.unitCost,
  }));
  return { requirements, shortages: requirements.filter((row) => row.shortage !== "0.0000") };
}
