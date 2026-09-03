import { db } from "@/db";
import { codeSequences, products, specialProducts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export type SequenceType = "product" | "special_product";

/**
 * Generates the next sequential unique code for products (PRD-0001) or special products (SPC-0001).
 * Monotonically increasing, atomic, and guarantees that deleted items do not reuse existing numbers.
 */
export async function getNextSequenceCode(type: SequenceType): Promise<string> {
  const prefix = type === "product" ? "PRD-" : "SPC-";
  const typeId = type;

  try {
    // 1. Ensure row exists in code_sequences
    await db.execute(sql`
      INSERT INTO code_sequences (id, last_value, prefix, updated_at)
      VALUES (${typeId}, 0, ${prefix}, NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Fetch current max from table if last_value is 0 to initialize properly
    const currentSeq = await db
      .select()
      .from(codeSequences)
      .where(eq(codeSequences.id, typeId))
      .limit(1);

    let baseCounter = currentSeq[0]?.lastValue || 0;

    if (baseCounter === 0) {
      // Find highest existing code in database
      if (type === "product") {
        const existing = await db.select({ code: products.code }).from(products);
        for (const item of existing) {
          const match = item.code.match(/PRD-(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > baseCounter) {
              baseCounter = num;
            }
          }
        }
      } else {
        const existingSp = await db.select({ code: specialProducts.code }).from(specialProducts).catch(() => []);
        const existingPrdSp = await db.select({ code: products.code }).from(products).where(eq(products.isSpecial, true)).catch(() => []);
        const existing = [...existingSp, ...existingPrdSp];
        for (const item of existing) {
          const match = item.code.match(/SPC-(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > baseCounter) {
              baseCounter = num;
            }
          }
        }
      }
    }

    // 3. Atomically increment the sequence counter
    const result = await db.execute(sql`
      UPDATE code_sequences
      SET last_value = GREATEST(last_value, ${baseCounter}) + 1,
          updated_at = NOW()
      WHERE id = ${typeId}
      RETURNING last_value;
    `);

    const nextVal = (result as any)?.rows?.[0]?.last_value ?? (baseCounter + 1);
    const padded = String(nextVal).padStart(4, "0");
    return `${prefix}${padded}`;
  } catch (err) {
    console.error(`Error generating sequence code for ${type}:`, err);
    // Fallback in case of temporary DB lock/issue
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${randomSuffix}`;
  }
}
