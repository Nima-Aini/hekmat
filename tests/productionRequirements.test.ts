import { describe, expect, it } from "vitest";
import { calculateProductionRequirements, type MaterialRequirementRow } from "../src/lib/productionRequirements";

const row = (id: string, stock: string, quantityRequired: string, wastagePercent = "0"): MaterialRequirementRow => ({
  rawMaterialId: id, rawMaterialName: `ماده ${id}`, code: id, unit: "کیلوگرم", stock,
  quantityRequired, wastagePercent, unitCost: 100,
});

describe("production BOM shortage calculation", () => {
  it("reports every shortage with the sum of duplicate recipe rows", () => {
    const result = calculateProductionRequirements([row("A", "2", "1"), row("A", "2", "0.5"), row("B", "1", "1")], 2);
    expect(result.shortages).toMatchObject([
      { materialId: "A", required: "3.0000", available: "2.0000", shortage: "1.0000" },
      { materialId: "B", required: "2.0000", available: "1.0000", shortage: "1.0000" },
    ]);
  });

  it("rounds wastage upward at stock precision", () => {
    const result = calculateProductionRequirements([row("A", "1", "0.3333", "1")], 3);
    expect(result.shortages[0]).toMatchObject({ required: "1.0099", shortage: "0.0099" });
  });

  it("rejects malformed recipes", () => {
    expect(() => calculateProductionRequirements([row("A", "1", "0")], 2)).toThrow();
  });
});
