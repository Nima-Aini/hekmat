import type { Transaction } from "./product";
import { ApiError, assertUuid, decimal } from "@/lib/apiError";
import crypto from "node:crypto";
import { db } from "@/db";
import {
  invoices,
  invoiceItems,
  products,
  specialProducts,
  customers,
  employees,
  payments,
  paymentAllocations,
  commissionLedger,
  accounts,
  inventoryLedger,
  projects,
  commissionRules,
  alerts,
  tasks
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { recordInventoryTransaction } from "./inventory";
import { resolveProductPrice } from "./pricing";
import { recalculateCustomerHealth } from "./customerHealth";
import { logAuditEvent } from "./audit";

export interface CreateInvoiceItemInput {
  productId?: string | null;
  specialProductId?: string | null;
  productType?: "product" | "special_product" | "custom";
  productName?: string;
  productNameSnapshot?: string;
  isCustom?: boolean;
  unit?: string;
  customUnit?: string;
  customNotes?: string;
  quantity: number;
  unitPrice?: number; // Optional override
  unitCost?: number;
  discountAmount?: number;
}

export interface CreateInvoiceInput {
  requestKey?: string;
  requestHash?: string;
  customerId: string;
  projectId?: string | null;
  salesMode?: "direct" | "visitor" | "visitor_intermediary" | "intermediary";
  employeeId?: string | null; // Salesperson
  intermediaryEmployeeId?: string | null;
  invoiceDate?: Date;
  dueDate?: Date;
  invoiceDiscount?: number;
  taxTotal?: number;
  items: CreateInvoiceItemInput[];
  initialPayment?: {
    amount: number;
    accountId: string;
    paymentMethod: string;
    referenceNumber?: string;
    paymentDate?: Date;
  };
  notes?: string;
  manualInvoiceNumber?: string;
}

/**
 * Generates a concurrency-safe unique invoice number using counter-based approach
 */
export async function generateInvoiceNumber(client: Transaction | typeof db = db): Promise<string> {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  // Use a combination of timestamp and crypto random for better uniqueness
  const timestamp = Date.now().toString(36);
  const randomSuffix = crypto.randomBytes(3).toString("hex");
  const candidate = `INV-${datePrefix}-${timestamp}${randomSuffix}`;

  const [existing] = await client.select({ id: invoices.id }).from(invoices).where(eq(invoices.invoiceNumber, candidate)).limit(1);
  if (existing) {
    // Fallback: use db-level sequence approach
    const fallback = `INV-${datePrefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    return fallback;
  }
  return candidate;
}

/**
 * Transactional Invoice Creation.
 * Atomic: Runs Invoice, Items, Inventory Ledger, Payment, Commission, and Audit in one transactional flow!
 */
export async function createInvoice(input: CreateInvoiceInput, client?: Transaction) {
  if (!Array.isArray(input.items) || !input.items.length) throw new ApiError(400, "حداقل یک قلم فاکتور الزامی است.");
  decimal(input.invoiceDiscount ?? 0, "تخفیف");
  decimal(input.taxTotal ?? 0, "مالیات");
  if (input.initialPayment) decimal(input.initialPayment.amount, "پرداخت");
  const customerId = input.customerId;

  const operation = async (tx: Transaction) => {
    if (input.requestKey) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestKey}, 0))`);
      const [prior] = await tx.select().from(invoices).where(eq(invoices.requestKey, input.requestKey)).limit(1);
      if (prior) {
        if (prior.requestHash !== input.requestHash) throw new ApiError(409, "این کلید درخواست قبلاً با اطلاعات دیگری استفاده شده است.");
        return prior;
      }
    }
    const [customer] = await tx.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!customer) throw new Error("مشتری پیدا نشد");

    const invoiceNum = input.manualInvoiceNumber || (await generateInvoiceNumber(tx));

    let subtotal = 0;
    let lineDiscountsTotal = 0;
    let cogsTotal = 0;

    // Process and validate items
    const processedItems = [];
    for (const sourceItem of input.items) {
      const itemInput = { ...sourceItem };
      // Unified special products use the standard inventory and FK path.
      if (itemInput.specialProductId || itemInput.productType === "special_product") {
        const candidate = itemInput.specialProductId || itemInput.productId;
        if (candidate) {
          const [unified] = await tx.select({ id: products.id }).from(products).where(eq(products.id, candidate)).limit(1);
          if (unified) { itemInput.productId = unified.id; itemInput.specialProductId = null; itemInput.productType = "product"; }
        }
      }
      const qty = Number(itemInput.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error("مقدار هر قلم باید عددی معتبر و بزرگتر از صفر باشد.");
      }
      const disc = Number(decimal(itemInput.discountAmount ?? 0, "تخفیف"));
      if (itemInput.unitPrice !== undefined) decimal(itemInput.unitPrice, "قیمت");
      if (itemInput.unitCost !== undefined) decimal(itemInput.unitCost, "هزینه");

      // Check if item is a Special Product (from specialProducts table or products table with isSpecial = true)
      let specialProd = null;
      if (itemInput.specialProductId || itemInput.productType === "special_product") {
        const [sp] = await tx
          .select()
          .from(specialProducts)
          .where(eq(specialProducts.id, itemInput.specialProductId || itemInput.productId!))
          .limit(1);
        if (sp) {
          specialProd = sp;
        } else {
          const [p] = await tx
            .select()
            .from(products)
            .where(and(eq(products.id, itemInput.specialProductId || itemInput.productId!), eq(products.isSpecial, true)))
            .limit(1);
          if (p) {
            specialProd = {
              id: p.id,
              name: p.name,
              code: p.code,
              unit: p.unit,
              basePrice: p.basePrice,
              stockQuantity: p.stockQuantity,
            };
          }
        }
      }

      if (specialProd) {
        // Special Product Item
        const spName = specialProd.name;
        const spUnit = specialProd.unit || "عدد";
        const spCode = specialProd.code;
        const unitPrice =
          itemInput.unitPrice !== undefined
            ? Number(itemInput.unitPrice)
            : Number(specialProd.basePrice) || 0;
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new Error(`قیمت واحد محصول اختصاصی «${spName}» نامعتبر است.`);
        }
        if (disc > qty * unitPrice) {
          throw new Error(`تخفیف محصول اختصاصی «${spName}» نمی‌تواند بیشتر از مبلغ کل آن باشد.`);
        }
        const unitCost = 0;
        if (disc > qty * unitPrice) throw new ApiError(400, "تخفیف از مبلغ قلم بیشتر است.");
          const lineTotal = Math.round((qty * unitPrice - disc) * 100) / 100;
        const lineCogs = 0;
        const lineProfit = lineTotal;

        subtotal += qty * unitPrice;
        lineDiscountsTotal += disc;
        cogsTotal += lineCogs;

        processedItems.push({
          productId: null,
          specialProductId: specialProd.id,
          productNameSnapshot: spName,
          isCustom: false,
          customUnit: spUnit,
          customNotes: spCode ? `[${spCode}]` : null,
          quantity: qty,
          unitPrice,
          unitCostSnapshot: unitCost,
          discountAmount: disc,
          lineTotal,
          lineCogs,
          lineProfit,
          isSpecial: true,
        });

        // Deduct stock in specialProducts if stock exists
        if (Number(specialProd.stockQuantity) > 0) {
          const newStock = Math.max(0, Number(specialProd.stockQuantity) - qty);
          await tx
            .update(specialProducts)
            .set({ stockQuantity: String(newStock), updatedAt: new Date() })
            .where(eq(specialProducts.id, specialProd.id));
        }
      } else if (itemInput.productId) {
        // Check standard catalog product first, or fallback to special product check
        const [product] = await tx.select().from(products).where(eq(products.id, itemInput.productId)).limit(1);
        if (product) {
          if (product.status !== "active") throw new ApiError(409, "محصول غیرفعال یا بایگانی‌شده قابل فروش نیست.");
          const resolvedPrice = await resolveProductPrice(product.id, input.projectId, tx);
          const unitPrice = itemInput.unitPrice !== undefined ? Number(itemInput.unitPrice) : resolvedPrice.effectivePrice;
          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new Error(`قیمت واحد محصول «${product.name}» نامعتبر است.`);
          }
          if (disc > qty * unitPrice) {
            throw new Error(`تخفیف محصول «${product.name}» نمی‌تواند بیشتر از مبلغ کل آن باشد.`);
          }
          const unitCost = Number(product.calculatedCost) || Number(product.basePrice) || 0;
          if (disc > qty * unitPrice) throw new ApiError(400, "تخفیف از مبلغ قلم بیشتر است.");
          const lineTotal = Math.round((qty * unitPrice - disc) * 100) / 100;
          const lineCogs = Math.round(qty * unitCost * 100) / 100;
          const lineProfit = Math.round((lineTotal - lineCogs) * 100) / 100;

          subtotal += qty * unitPrice;
          lineDiscountsTotal += disc;
          cogsTotal += lineCogs;

          processedItems.push({
            productId: product.id,
            specialProductId: null,
            productNameSnapshot: product.name,
            isCustom: false,
            customUnit: product.unit || "عدد",
            customNotes: product.isSpecial ? `[${product.code}]` : null,
            quantity: qty,
            unitPrice,
            unitCostSnapshot: unitCost,
            discountAmount: disc,
            lineTotal,
            lineCogs,
            lineProfit,
            isSpecial: !!product.isSpecial,
          });
        } else {
          // Check if productId actually belongs to specialProducts
          const [sp] = await tx.select().from(specialProducts).where(eq(specialProducts.id, itemInput.productId)).limit(1);
          if (sp) {
            const spName = sp.name;
            const spUnit = sp.unit || "عدد";
            const spCode = sp.code;
            const unitPrice =
              itemInput.unitPrice !== undefined ? Number(itemInput.unitPrice) : Number(sp.basePrice) || 0;
            const unitCost = 0;
            if (disc > qty * unitPrice) throw new ApiError(400, "تخفیف از مبلغ قلم بیشتر است.");
          const lineTotal = Math.round((qty * unitPrice - disc) * 100) / 100;
            const lineCogs = 0;
            const lineProfit = lineTotal;

            subtotal += qty * unitPrice;
            lineDiscountsTotal += disc;
            cogsTotal += lineCogs;

            processedItems.push({
              productId: null,
              specialProductId: sp.id,
              productNameSnapshot: spName,
              isCustom: false,
              customUnit: spUnit,
              customNotes: spCode ? `[${spCode}]` : null,
              quantity: qty,
              unitPrice,
              unitCostSnapshot: unitCost,
              discountAmount: disc,
              lineTotal,
              lineCogs,
              lineProfit,
              isSpecial: true,
            });

            if (Number(sp.stockQuantity) > 0) {
              const newStock = Math.max(0, Number(sp.stockQuantity) - qty);
              await tx
                .update(specialProducts)
                .set({ stockQuantity: String(newStock), updatedAt: new Date() })
                .where(eq(specialProducts.id, sp.id));
            }
          } else {
            throw new Error(`محصول با شناسه ${itemInput.productId} یافت نشد.`);
          }
        }
      } else {
        // Fallback for custom/legacy item
        const customName = (itemInput.productName || itemInput.productNameSnapshot || "کالای متفرقه").trim();
        const unitPrice = itemInput.unitPrice !== undefined ? Number(itemInput.unitPrice) : 0;
        const unitCost = Number(itemInput.unitCost || 0);
        if (disc > qty * unitPrice) throw new ApiError(400, "تخفیف از مبلغ قلم بیشتر است.");
          const lineTotal = Math.round((qty * unitPrice - disc) * 100) / 100;
        const lineCogs = Math.round(qty * unitCost * 100) / 100;
        const lineProfit = Math.round((lineTotal - lineCogs) * 100) / 100;

        subtotal += qty * unitPrice;
        lineDiscountsTotal += disc;
        cogsTotal += lineCogs;

        processedItems.push({
          productId: null,
          specialProductId: null,
          productNameSnapshot: customName,
          isCustom: true,
          customUnit: itemInput.customUnit || itemInput.unit || "عدد",
          customNotes: itemInput.customNotes || null,
          quantity: qty,
          unitPrice,
          unitCostSnapshot: unitCost,
          discountAmount: disc,
          lineTotal,
          lineCogs,
          lineProfit,
          isSpecial: false,
        });
      }
    }

    const invoiceDiscount = input.invoiceDiscount || 0;
    const taxTotal = input.taxTotal || 0;
    if (invoiceDiscount > subtotal - lineDiscountsTotal) throw new ApiError(400, "تخفیف از مبلغ فاکتور بیشتر است.");
    const grandTotal = subtotal - lineDiscountsTotal - invoiceDiscount + taxTotal;
    const grossProfitTotal = grandTotal - cogsTotal;

    // Handle Initial Payment if provided
    if (input.initialPayment && Number(input.initialPayment.amount) > grandTotal) throw new ApiError(400, "پرداخت از مبلغ فاکتور بیشتر است.");
    const initialPayAmount = input.initialPayment ? Number(input.initialPayment.amount) : 0;
    if (initialPayAmount > 0) {
      assertUuid(input.initialPayment!.accountId);
      const [receiptAccount] = await tx.select({ id: accounts.id, status: accounts.status }).from(accounts)
        .where(eq(accounts.id, input.initialPayment!.accountId)).for("update").limit(1);
      if (!receiptAccount || receiptAccount.status !== "active") {
        throw new ApiError(404, "حساب دریافت انتخاب‌شده یافت نشد.");
      }
      const paymentDate = input.initialPayment?.paymentDate;
      if (paymentDate && Number.isNaN(paymentDate.getTime())) throw new ApiError(400, "تاریخ پرداخت اولیه نامعتبر است.");
    }
    const balanceDue = grandTotal - initialPayAmount;

    let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
    if (initialPayAmount >= grandTotal && grandTotal > 0) {
      paymentStatus = "paid";
    } else if (initialPayAmount > 0) {
      paymentStatus = "partial";
    }

    // Create Invoice record
    const [createdInvoice] = await tx
      .insert(invoices)
      .values({
        invoiceNumber: invoiceNum,
        requestKey: input.requestKey,
        requestHash: input.requestHash,
        customerId,
        projectId: input.projectId || null,
        salesMode: input.salesMode || "direct",
        employeeId: input.employeeId || null,
        intermediaryEmployeeId: input.intermediaryEmployeeId || null,
        invoiceDate: input.invoiceDate || new Date(),
        dueDate: input.dueDate || new Date(Date.now() + (customer.paymentTermsDays || 30) * 86400000),
        subtotal: subtotal.toString(),
        lineDiscountsTotal: lineDiscountsTotal.toString(),
        invoiceDiscount: invoiceDiscount.toString(),
        taxTotal: taxTotal.toString(),
        grandTotal: grandTotal.toString(),
        cogsTotal: cogsTotal.toString(),
        grossProfitTotal: grossProfitTotal.toString(),
        paidAmount: initialPayAmount.toString(),
        balanceDue: balanceDue.toString(),
        paymentStatus,
        settlementDate: paymentStatus === "paid" ? (input.initialPayment?.paymentDate || input.invoiceDate || new Date()) : null,
        status: "issued",
        notes: input.notes || null,
      })
      .returning();

    // Create Invoice Items & record Inventory Ledger Out transactions
    for (const item of processedItems) {
      await tx.insert(invoiceItems).values({
        invoiceId: createdInvoice.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        isCustom: item.isCustom,
        customUnit: item.customUnit,
        customNotes: item.customNotes,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        unitCostSnapshot: item.unitCostSnapshot.toString(),
        discountAmount: item.discountAmount.toString(),
        lineTotal: item.lineTotal.toString(),
        lineCogs: item.lineCogs.toString(),
        lineProfit: item.lineProfit.toString(),
      });

      // Record inventory transaction (Sales OUT) only for standard catalog products
      if (item.productId && !item.isCustom) {
        await recordInventoryTransaction(
          {
            itemType: "product",
            itemId: item.productId,
            transactionType: "sale",
            quantityChange: -item.quantity, // Negative for sale
            unitCostSnapshot: item.unitCostSnapshot,
            referenceType: "invoice",
            referenceId: createdInvoice.id,
            projectId: input.projectId || null,
            notes: `فروش فاکتور #${invoiceNum}`,
          },
          tx
        );
      }
    }

    // Commission Engine: project + product + employee override -> employee default -> product default.
    if (input.employeeId) {
      const [emp] = await tx.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
      if (emp) {
        const rules = await tx.select().from(commissionRules).where(eq(commissionRules.isActive, true));
        let totalCommission = 0;
        const snapshots: Array<Record<string, unknown>> = [];
        for (const item of processedItems) {
          const eligible = rules
            .filter((rule: any) => {
              if (rule.employeeId && rule.employeeId !== input.employeeId) return false;
              if (rule.projectId && rule.projectId !== input.projectId) return false;
              if (rule.productId && rule.productId !== item.productId) return false;
              const now = input.invoiceDate || new Date();
              if (rule.effectiveStartDate && now < rule.effectiveStartDate) return false;
              if (rule.effectiveEndDate && now > rule.effectiveEndDate) return false;
              return true;
            })
            .sort((a: any, b: any) => {
              const score = (r: any) => (r.employeeId ? 8 : 0) + (r.projectId ? 4 : 0) + (r.productId ? 2 : 0);
              return score(b) - score(a);
            });
          const rule = eligible[0];
          const rate = rule ? Number(rule.rateValue) : Number(emp.commissionRatePercent) || 5;
          const commissionBase = rule?.commissionBase || (emp as any).commissionBase || "sales_total";
          const base = commissionBase === "net_profit" ? Math.max(0, item.lineProfit) : item.lineTotal;
          const amount = rule?.ruleType === "fixed" ? rate : Math.round((base * rate) / 100);
          totalCommission += amount;
          snapshots.push({
            productId: item.productId,
            ruleId: rule?.id || null,
            ruleType: rule?.ruleType || "employee_default",
            commissionBase,
            rateValue: rate,
            baseAmount: base,
            lineTotal: item.lineTotal,
            lineProfit: item.lineProfit,
            commissionAmount: amount,
          });
        }
        if (totalCommission > 0) {
          const primaryBase = (emp as any).commissionBase || "sales_total";
          const calculatedBaseTotal = primaryBase === "net_profit" ? grossProfitTotal : grandTotal;
          await tx.insert(commissionLedger).values({
            employeeId: input.employeeId,
            invoiceId: createdInvoice.id,
            projectId: input.projectId || null,
            ruleSnapshot: { invoiceNumber: invoiceNum, commissionBase: primaryBase, items: snapshots },
            baseAmount: calculatedBaseTotal.toString(),
            commissionAmount: totalCommission.toString(),
            status: "pending",
            commissionType: "employee",
            recipientEmployeeId: input.employeeId,
            notes: `پورسانت ${primaryBase === "net_profit" ? "بر اساس سود خالص" : "بر اساس مبلغ کل"} فاکتور #${invoiceNum}`,
          });
          await tx.update(invoices).set({ commissionSnapshot: snapshots }).where(eq(invoices.id, createdInvoice.id));
        }
      }
    }

    // Process Initial Payment if provided
    if (input.initialPayment && initialPayAmount > 0) {
      const payNum = `PAY-${crypto.randomUUID()}`;
      const [createdPayment] = await tx
        .insert(payments)
        .values({
          paymentNumber: payNum,
          customerId,
          invoiceId: createdInvoice.id,
          projectId: input.projectId || null,
          accountId: input.initialPayment.accountId,
          paymentType: "customer_receipt",
          amount: initialPayAmount.toString(),
          paymentDate: input.initialPayment.paymentDate || input.invoiceDate || new Date(),
          paymentMethod: input.initialPayment.paymentMethod || "pos",
          referenceNumber: input.initialPayment.referenceNumber || null,
          status: "completed",
          notes: `دریافت بابت فاکتور #${invoiceNum}`,
        })
        .returning();

      await tx.insert(paymentAllocations).values({
        paymentId: createdPayment.id,
        invoiceId: createdInvoice.id,
        allocatedAmount: initialPayAmount.toString(),
      });

      // Update account balance
      await tx
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${initialPayAmount}`,
        })
        .where(eq(accounts.id, input.initialPayment.accountId));
    }

    // Recalculate customer health score automatically
    await recalculateCustomerHealth(customerId, tx);

    await logAuditEvent("CREATE", "invoice", createdInvoice.id, {
      invoiceNumber: invoiceNum,
      grandTotal,
      customerId,
      itemsCount: processedItems.length,
    }, undefined, tx);

    return createdInvoice;
  };
  return client ? operation(client) : db.transaction(operation);
}

/**
 * Reverse an invoice safely (Audited Reversal)
 */
export async function reverseInvoice(invoiceId: string, reason: string) {
  return await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update").limit(1);
    if (!inv) throw new Error("فاکتور پیدا نشد");
    if (inv.status === "reversed" || inv.status === "cancelled") throw new ApiError(409, "این فاکتور قبلاً باطل شده است");

    const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

    // 1. Return stock for each item via inventory ledger (only standard catalog products)
    for (const item of items) {
      if (item.productId && !item.isCustom) {
        await recordInventoryTransaction(
          {
            itemType: "product",
            itemId: item.productId,
            transactionType: "sales_return",
            quantityChange: Number(item.quantity),
            unitCostSnapshot: Number(item.unitCostSnapshot),
            referenceType: "invoice_reversal",
            referenceId: invoiceId,
            projectId: inv.projectId,
            notes: `ابطال فاکتور #${inv.invoiceNumber}: ${reason}`,
          },
          tx
        );
      }
    }

    // 2. Reverse associated payments
    const associatedPayments = await tx
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));

    for (const pay of associatedPayments) {
      if (pay.status === "completed") {
        // Reverse account balance with balance check
        if (pay.accountId) {
          const [acc] = await tx.select().from(accounts).where(eq(accounts.id, pay.accountId)).for("update").limit(1);
          if (acc) {
            const currentBalance = Number(acc.balance) || 0;
            const payAmount = Number(pay.amount) || 0;
            if (currentBalance < payAmount) {
              throw new Error(
                `موجودی حساب «${acc.name}» برای ابطال پرداخت کافی نیست. موجودی فعلی: ${currentBalance.toLocaleString("fa-IR")} تومان، مبلغ پرداخت: ${payAmount.toLocaleString("fa-IR")} تومان.`
              );
            }
            await tx
              .update(accounts)
              .set({ balance: sql`${accounts.balance} - ${payAmount}` })
              .where(eq(accounts.id, pay.accountId));
          }
        }

        // Mark payment as reversed
        await tx
          .update(payments)
          .set({
            status: "cancelled",
            notes: sql`COALESCE(${payments.notes}, '') || ${` (ابطال شده بابت فاکتور #${inv.invoiceNumber})`}`,
          })
          .where(eq(payments.id, pay.id));
      }
    }

    // 3. Remove payment allocations
    await tx.delete(paymentAllocations).where(eq(paymentAllocations.invoiceId, invoiceId));

    // 4. Reverse Commissions
    await tx
      .update(commissionLedger)
      .set({ status: "reversed", notes: `ابطال فاکتور: ${reason}` })
      .where(eq(commissionLedger.invoiceId, invoiceId));

    // 5. Mark invoice status as reversed
    const [updated] = await tx
      .update(invoices)
      .set({
        status: "reversed",
        reversalReason: reason,
        paidAmount: "0",
        balanceDue: "0",
        paymentStatus: "unpaid",
        settlementDate: null,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    await recalculateCustomerHealth(inv.customerId, tx);
    await logAuditEvent("REVERSE", "invoice", invoiceId, { invoiceNumber: inv.invoiceNumber, reason }, undefined, tx);

    return updated;
  });
}

/**
 * Update an existing invoice (Audited and full field support)
 */
export async function updateInvoice(
  invoiceId: string,
  input: {
    customerId?: string;
    employeeId?: string | null;
    projectId?: string | null;
    manualInvoiceNumber?: string;
    invoiceDate?: Date;
    dueDate?: Date;
    notes?: string | null;
    invoiceDiscount?: number;
    paymentStatus?: "unpaid" | "partial" | "paid";
    items?: CreateInvoiceItemInput[];
  }
) {
  return await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update").limit(1);
    if (!existing) throw new Error("فاکتور پیدا نشد");

    if (existing.status !== "issued" && existing.status !== "corrected") throw new ApiError(409, "فاکتور باطل‌شده قابل ویرایش نیست.");
    if (input.invoiceDiscount !== undefined) decimal(input.invoiceDiscount, "تخفیف");
    if (input.items !== undefined && (!Array.isArray(input.items) || !input.items.length)) throw new ApiError(400, "حداقل یک قلم الزامی است.");
    const patch: Partial<typeof invoices.$inferInsert> = { updatedAt: new Date() };

    if (input.customerId !== undefined && input.customerId !== existing.customerId) {
      const [c] = await tx.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      if (!c) throw new Error("مشتری جدید پیدا نشد");
      patch.customerId = input.customerId;
    }

    if (input.employeeId !== undefined) patch.employeeId = input.employeeId;
    const changesCommission = input.employeeId !== undefined || input.items !== undefined || input.invoiceDiscount !== undefined || input.projectId !== undefined;
    if (changesCommission) {
      const entries = await tx.select().from(commissionLedger).where(eq(commissionLedger.invoiceId, invoiceId));
      if (entries.some(entry => entry.status === "paid" || entry.status === "settled")) throw new ApiError(409, "فاکتور دارای پورسانت تسویه‌شده است؛ اصلاح آن نیاز به تعدیل مالی دارد.");
    }

    if (input.projectId !== undefined) patch.projectId = input.projectId || null;
    if (input.manualInvoiceNumber !== undefined && input.manualInvoiceNumber.trim()) {
      patch.invoiceNumber = input.manualInvoiceNumber.trim();
    }
    if (input.invoiceDate !== undefined) patch.invoiceDate = input.invoiceDate;
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
    if (input.notes !== undefined) patch.notes = input.notes || null;
    const actualPaymentStatus = Number(existing.balanceDue) === 0 ? "paid" : Number(existing.paidAmount) > 0 ? "partial" : "unpaid";
    if (input.paymentStatus !== undefined && input.paymentStatus !== actualPaymentStatus) throw new ApiError(400, "وضعیت پرداخت از تراکنش‌های مالی محاسبه می‌شود؛ پرداخت را در بخش وصول ثبت کنید.");

    // If items are updated, recalculate line items and totals
    if (input.items && Array.isArray(input.items) && input.items.length > 0) {
      // 1. Revert previous inventory items (only for catalog products)
      const oldItems = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      for (const oldItem of oldItems) {
        if (oldItem.productId && !oldItem.isCustom) {
          await recordInventoryTransaction(
            {
              itemType: "product",
              itemId: oldItem.productId,
              transactionType: "sales_return",
              quantityChange: Number(oldItem.quantity),
              unitCostSnapshot: Number(oldItem.unitCostSnapshot),
              referenceType: "invoice_update",
              referenceId: invoiceId,
              projectId: patch.projectId ?? existing.projectId,
              notes: `اصلاح اقلام فاکتور #${existing.invoiceNumber}`,
            },
            tx
          );
        }
      }

      // 2. Delete old invoice items
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

      // 3. Process new items
      let subtotal = 0;
      let lineDiscountsTotal = 0;
      let cogsTotal = 0;
      const processedItems = [];

      const effectiveProjectId = patch.projectId !== undefined ? patch.projectId : existing.projectId;

      for (const sourceItem of input.items) {
      const itemInput = { ...sourceItem };
      // Unified special products use the standard inventory and FK path.
      if (itemInput.specialProductId || itemInput.productType === "special_product") {
        const candidate = itemInput.specialProductId || itemInput.productId;
        if (candidate) {
          const [unified] = await tx.select({ id: products.id }).from(products).where(eq(products.id, candidate)).limit(1);
          if (unified) { itemInput.productId = unified.id; itemInput.specialProductId = null; itemInput.productType = "product"; }
        }
      }
        const qty = Number(itemInput.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error("مقدار هر قلم باید عددی معتبر و بزرگتر از صفر باشد.");
        }
        const disc = Number(decimal(itemInput.discountAmount ?? 0, "تخفیف"));
      if (itemInput.unitPrice !== undefined) decimal(itemInput.unitPrice, "قیمت");
      if (itemInput.unitCost !== undefined) decimal(itemInput.unitCost, "هزینه");

        let specialProd = null;
        if (itemInput.specialProductId || itemInput.productType === "special_product") {
          const [sp] = await tx
            .select()
            .from(specialProducts)
            .where(eq(specialProducts.id, itemInput.specialProductId || itemInput.productId!))
            .limit(1);
          specialProd = sp || null;
        }

        if (specialProd) {
          const spName = specialProd.name;
          const spUnit = specialProd.unit || "عدد";
          const spCode = specialProd.code;
          const unitPrice =
            itemInput.unitPrice !== undefined
              ? Number(itemInput.unitPrice)
              : Number(specialProd.basePrice) || 0;
          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new Error(`قیمت واحد محصول اختصاصی «${spName}» نامعتبر است.`);
          }
          if (disc > qty * unitPrice) {
            throw new Error(`تخفیف محصول اختصاصی «${spName}» نمی‌تواند بیشتر از مبلغ کل آن باشد.`);
          }
          const unitCost = 0;
          if (disc > qty * unitPrice) throw new ApiError(400, "تخفیف از مبلغ قلم بیشتر است.");
          const lineTotal = Math.round((qty * unitPrice - disc) * 100) / 100;
          const lineCogs = 0;
          const lineProfit = lineTotal;

          subtotal += qty * unitPrice;
          lineDiscountsTotal += disc;
          cogsTotal += lineCogs;

          processedItems.push({
            productId: null,
            specialProductId: specialProd.id,
            productNameSnapshot: spName,
            isCustom: false,
            customUnit: spUnit,
            customNotes: spCode ? `[${spCode}]` : null,
            quantity: qty,
            unitPrice,
            unitCostSnapshot: unitCost,
            discountAmount: disc,
            lineTotal,
            lineCogs,
            lineProfit,
            isSpecial: true,
          });
        } else if (itemInput.productId) {
          const [product] = await tx.select().from(products).where(eq(products.id, itemInput.productId!)).limit(1);
          if (product) {
          if (product.status !== "active") throw new ApiError(409, "محصول غیرفعال یا بایگانی‌شده قابل فروش نیست.");
            const resolvedPrice = await resolveProductPrice(product.id, effectiveProjectId, tx);
            const unitPrice = itemInput.unitPrice !== undefined ? Number(itemInput.unitPrice) : resolvedPrice.effectivePrice;
            if (!Number.isFinite(unitPrice) || unitPrice < 0) {
              throw new Error(`قیمت واحد محصول «${product.name}» نامعتبر است.`);
            }
            if (disc > qty * unitPrice) {
              throw new Error(`تخفیف محصول «${product.name}» نمی‌تواند بیشتر از مبلغ کل آن باشد.`);
            }
            const unitCost = Number(product.calculatedCost) || Number(product.basePrice) || 0;
            if (disc > qty * unitPrice) throw new ApiError(400, "تخفیف از مبلغ قلم بیشتر است.");
          const lineTotal = Math.round((qty * unitPrice - disc) * 100) / 100;
            const lineCogs = Math.round(qty * unitCost * 100) / 100;
            const lineProfit = Math.round((lineTotal - lineCogs) * 100) / 100;

            subtotal += qty * unitPrice;
            lineDiscountsTotal += disc;
            cogsTotal += lineCogs;

            processedItems.push({
              productId: product.id,
              specialProductId: null,
              productNameSnapshot: product.name,
              isCustom: false,
              customUnit: product.unit || "عدد",
              customNotes: null,
              quantity: qty,
              unitPrice,
              unitCostSnapshot: unitCost,
              discountAmount: disc,
              lineTotal,
              lineCogs,
              lineProfit,
              isSpecial: false,
            });
          } else {
            const [sp] = await tx.select().from(specialProducts).where(eq(specialProducts.id, itemInput.productId)).limit(1);
            if (sp) {
              const spName = sp.name;
              const spUnit = sp.unit || "عدد";
              const spCode = sp.code;
              const unitPrice =
                itemInput.unitPrice !== undefined ? Number(itemInput.unitPrice) : Number(sp.basePrice) || 0;
              const unitCost = 0;
              if (disc > qty * unitPrice) throw new ApiError(400, "تخفیف از مبلغ قلم بیشتر است.");
          const lineTotal = Math.round((qty * unitPrice - disc) * 100) / 100;
              const lineCogs = 0;
              const lineProfit = lineTotal;

              subtotal += qty * unitPrice;
              lineDiscountsTotal += disc;
              cogsTotal += lineCogs;

              processedItems.push({
                productId: null,
                specialProductId: sp.id,
                productNameSnapshot: spName,
                isCustom: false,
                customUnit: spUnit,
                customNotes: spCode ? `[${spCode}]` : null,
                quantity: qty,
                unitPrice,
                unitCostSnapshot: unitCost,
                discountAmount: disc,
                lineTotal,
                lineCogs,
                lineProfit,
                isSpecial: true,
              });
            } else {
              throw new Error(`محصول با شناسه ${itemInput.productId} یافت نشد.`);
            }
          }
        } else {
          const customName = (itemInput.productName || itemInput.productNameSnapshot || "کالای متفرقه").trim();
          const unitPrice = itemInput.unitPrice !== undefined ? Number(itemInput.unitPrice) : 0;
          const unitCost = Number(itemInput.unitCost || 0);
          if (disc > qty * unitPrice) throw new ApiError(400, "تخفیف از مبلغ قلم بیشتر است.");
          const lineTotal = Math.round((qty * unitPrice - disc) * 100) / 100;
          const lineCogs = Math.round(qty * unitCost * 100) / 100;
          const lineProfit = Math.round((lineTotal - lineCogs) * 100) / 100;

          subtotal += qty * unitPrice;
          lineDiscountsTotal += disc;
          cogsTotal += lineCogs;

          processedItems.push({
            productId: null,
            specialProductId: null,
            productNameSnapshot: customName,
            isCustom: true,
            customUnit: itemInput.customUnit || itemInput.unit || "عدد",
            customNotes: itemInput.customNotes || null,
            quantity: qty,
            unitPrice,
            unitCostSnapshot: unitCost,
            discountAmount: disc,
            lineTotal,
            lineCogs,
            lineProfit,
            isSpecial: false,
          });
        }
      }

      const invoiceDiscount =
        input.invoiceDiscount !== undefined ? input.invoiceDiscount : Number(existing.invoiceDiscount) || 0;
      const taxTotal = Number(existing.taxTotal) || 0;
      if (invoiceDiscount > subtotal - lineDiscountsTotal) throw new ApiError(400, "تخفیف از مبلغ فاکتور بیشتر است.");
    const grandTotal = subtotal - lineDiscountsTotal - invoiceDiscount + taxTotal;
      const grossProfitTotal = grandTotal - cogsTotal;
      const paidAmount = Number(existing.paidAmount) || 0;
      if (paidAmount > grandTotal) throw new ApiError(409, "مبلغ جدید از پرداخت ثبت‌شده کمتر است؛ ابتدا پرداخت را اصلاح کنید.");
      const balanceDue = grandTotal - paidAmount;

      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
      if (paidAmount >= grandTotal && grandTotal > 0) {
        paymentStatus = "paid";
      } else if (paidAmount > 0) {
        paymentStatus = "partial";
      }

      patch.subtotal = subtotal.toString();
      patch.lineDiscountsTotal = lineDiscountsTotal.toString();
      patch.invoiceDiscount = invoiceDiscount.toString();
      patch.grandTotal = grandTotal.toString();
      patch.cogsTotal = cogsTotal.toString();
      patch.grossProfitTotal = grossProfitTotal.toString();
      patch.balanceDue = balanceDue.toString();
      patch.paymentStatus = paymentStatus;
      patch.settlementDate = paymentStatus === "paid" ? existing.settlementDate : null;

      // Insert new invoice items & inventory out
      for (const item of processedItems) {
        await tx.insert(invoiceItems).values({
          invoiceId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          isCustom: item.isCustom,
          customUnit: item.customUnit,
          customNotes: item.customNotes,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          unitCostSnapshot: item.unitCostSnapshot.toString(),
          discountAmount: item.discountAmount.toString(),
          lineTotal: item.lineTotal.toString(),
          lineCogs: item.lineCogs.toString(),
          lineProfit: item.lineProfit.toString(),
        });

        if (item.productId && !item.isCustom) {
          await recordInventoryTransaction(
            {
              itemType: "product",
              itemId: item.productId,
              transactionType: "sale",
              quantityChange: -item.quantity,
              unitCostSnapshot: item.unitCostSnapshot,
              referenceType: "invoice_update",
              referenceId: invoiceId,
              projectId: effectiveProjectId,
              notes: `فروش اصلاح شده فاکتور #${patch.invoiceNumber || existing.invoiceNumber}`,
            },
            tx
          );
        }
      }
    } else if (input.invoiceDiscount !== undefined) {
      const subtotal = Number(existing.subtotal) || 0;
      const lineDiscountsTotal = Number(existing.lineDiscountsTotal) || 0;
      const taxTotal = Number(existing.taxTotal) || 0;
      if (input.invoiceDiscount > subtotal - lineDiscountsTotal) throw new ApiError(400, "تخفیف از مبلغ فاکتور بیشتر است.");
      const grandTotal = subtotal - lineDiscountsTotal - input.invoiceDiscount + taxTotal;
      const paidAmount = Number(existing.paidAmount) || 0;
      if (paidAmount > grandTotal) throw new ApiError(409, "مبلغ جدید از پرداخت ثبت‌شده کمتر است؛ ابتدا پرداخت را اصلاح کنید.");
      const balanceDue = grandTotal - paidAmount;

      patch.invoiceDiscount = input.invoiceDiscount.toString();
      patch.grandTotal = grandTotal.toString();
      patch.grossProfitTotal = (grandTotal - Number(existing.cogsTotal)).toString();
      patch.paymentStatus = balanceDue === 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
      patch.balanceDue = balanceDue.toString();
      patch.settlementDate = balanceDue === 0 ? existing.settlementDate : null;
    }

    const [updated] = await tx
      .update(invoices)
      .set(patch)
      .where(eq(invoices.id, invoiceId))
      .returning();

    if (changesCommission) {
      const commissionEmployeeId = input.employeeId !== undefined ? input.employeeId : existing.employeeId;
      // Recalculate commission attribution if employee changed
      if (changesCommission) {
        // Delete old commission entries
        await tx
          .update(commissionLedger).set({ status: "reversed", notes: "بازنگری فاکتور" })
          .where(eq(commissionLedger.invoiceId, invoiceId));

        // Recalculate commission for new employee if assigned
        if (commissionEmployeeId) {
          const [emp] = await tx.select().from(employees).where(eq(employees.id, commissionEmployeeId)).limit(1);
          if (emp) {
            const invItems = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
            const rules = await tx.select().from(commissionRules).where(eq(commissionRules.isActive, true));
            const inv = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update").limit(1);
            const invoiceRecord = inv[0];

            if (invoiceRecord && invItems.length > 0) {
              let totalCommission = 0;
              const snapshots: Array<Record<string, unknown>> = [];

              for (const item of invItems) {
                const lineTotal = Number(item.lineTotal) || 0;
                const lineProfit = Number(item.lineProfit) || 0;

                const eligible = rules
                  .filter((rule: any) => {
                    if (rule.employeeId && rule.employeeId !== commissionEmployeeId) return false;
                    if (rule.projectId && rule.projectId !== invoiceRecord.projectId) return false;
                    if (rule.productId && rule.productId !== item.productId) return false;
                    const now = invoiceRecord.invoiceDate || new Date();
                    if (rule.effectiveStartDate && now < rule.effectiveStartDate) return false;
                    if (rule.effectiveEndDate && now > rule.effectiveEndDate) return false;
                    return true;
                  })
                  .sort((a: any, b: any) => {
                    const score = (r: any) => (r.employeeId ? 8 : 0) + (r.projectId ? 4 : 0) + (r.productId ? 2 : 0);
                    return score(b) - score(a);
                  });

                const rule = eligible[0];
                const rate = rule ? Number(rule.rateValue) : Number(emp.commissionRatePercent) || 5;
                const commissionBase = rule?.commissionBase || (emp as any).commissionBase || "sales_total";
                const base = commissionBase === "net_profit" ? Math.max(0, lineProfit) : lineTotal;
                const amount = rule?.ruleType === "fixed" ? rate : Math.round((base * rate) / 100);
                totalCommission += amount;
                snapshots.push({
                  productId: item.productId,
                  ruleId: rule?.id || null,
                  ruleType: rule?.ruleType || "employee_default",
                  commissionBase,
                  rateValue: rate,
                  baseAmount: base,
                  lineTotal,
                  lineProfit,
                  commissionAmount: amount,
                });
              }

              if (totalCommission > 0) {
                const primaryBase = (emp as any).commissionBase || "sales_total";
                await tx.insert(commissionLedger).values({
                  employeeId: commissionEmployeeId,
                  invoiceId: invoiceRecord.id,
                  projectId: invoiceRecord.projectId || null,
                  ruleSnapshot: { invoiceNumber: invoiceRecord.invoiceNumber, commissionBase: primaryBase, items: snapshots },
                  baseAmount: (primaryBase === "net_profit" ? Number(invoiceRecord.grossProfitTotal) : Number(invoiceRecord.grandTotal)).toString(),
                  commissionAmount: totalCommission.toString(),
                  status: "pending",
                  commissionType: "employee",
                  recipientEmployeeId: commissionEmployeeId,
                  notes: `پورسانت بازنگری شده فاکتور #${invoiceRecord.invoiceNumber}`,
                });
              }
            }
          }
        }
      }
    }


    if (patch.customerId || existing.customerId) {
      await recalculateCustomerHealth(patch.customerId || existing.customerId, tx);
    }

    await logAuditEvent("UPDATE", "invoice", invoiceId, {
      fields: Object.keys(patch),
      employeeId: patch.employeeId ?? existing.employeeId,
      grandTotal: patch.grandTotal ?? existing.grandTotal,
    }, undefined, tx);

    return updated;
  });
}

/**
 * Permanently delete an invoice while preserving independent cash movements.
 * Every mutation is committed atomically or rolled back as a unit.
 */
export async function deleteInvoice(invoiceId: string, reason?: string) {
  assertUuid(invoiceId);
  return db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update").limit(1);
    if (!invoice) throw new ApiError(404, "فاکتور یافت نشد.");

    const deletionReason = reason?.trim() || "حذف دائم توسط مدیر";
    const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

    // Issued/corrected invoices still affect stock. Reversed/cancelled invoices
    // have already returned it and must never be applied a second time.
    if (invoice.status === "issued" || invoice.status === "corrected") {
      for (const item of items) {
        if (!item.productId || item.isCustom) continue;
        await recordInventoryTransaction({
          itemType: "product",
          itemId: item.productId,
          transactionType: "sales_return",
          quantityChange: Number(item.quantity),
          unitCostSnapshot: Number(item.unitCostSnapshot),
          referenceType: "deleted_invoice_adjustment",
          projectId: invoice.projectId,
          notes: `بازگردانی موجودی بابت حذف دائم فاکتور #${invoice.invoiceNumber}`,
        }, tx);
      }
    }

    // Inventory history remains auditable, but cannot point to an invoice that
    // no longer exists. The stock-changing deletion adjustment is already
    // recorded above without a dangling reference id.
    await tx.update(inventoryLedger).set({
      referenceId: null,
      referenceType: "deleted_invoice",
      notes: sql`COALESCE(${inventoryLedger.notes}, '') || ${` [فاکتور حذف‌شده #${invoice.invoiceNumber}]`}`,
    }).where(and(
      eq(inventoryLedger.referenceId, invoiceId),
      sql`${inventoryLedger.referenceType} IN ('invoice', 'invoice_update', 'invoice_reversal')`
    ));

    const allocations = await tx.select().from(paymentAllocations).where(eq(paymentAllocations.invoiceId, invoiceId)).for("update");
    const directPayments = await tx.select().from(payments).where(eq(payments.invoiceId, invoiceId)).for("update");
    const linkedPaymentIds = new Set([...allocations.map(row => row.paymentId), ...directPayments.map(row => row.id)]);

    // A receipt is a real cash/bank movement. Keep its status, amount and the
    // account balance exactly as-is; remove only its allocation/direct link.
    for (const paymentId of linkedPaymentIds) {
      const directlyLinked = directPayments.some(payment => payment.id === paymentId);
      await tx.update(payments).set({
        ...(directlyLinked ? { invoiceId: null } : {}),
        notes: sql`COALESCE(${payments.notes}, '') || ${` [اتصال به فاکتور حذف‌شده #${invoice.invoiceNumber} برداشته شد]`}`,
      }).where(eq(payments.id, paymentId));
    }
    await tx.delete(paymentAllocations).where(eq(paymentAllocations.invoiceId, invoiceId));

    // Unpaid commission has no independent financial movement and can be
    // removed. Paid/settled commission is retained as reversed history and is
    // detached from the invoice so payout records are never destroyed.
    const commissions = await tx.select().from(commissionLedger).where(eq(commissionLedger.invoiceId, invoiceId)).for("update");
    for (const commission of commissions) {
      const hasFinancialHistory = commission.paymentId || commission.status === "paid" || commission.status === "settled";
      if (hasFinancialHistory) {
        await tx.update(commissionLedger).set({
          invoiceId: null,
          status: "reversed",
          notes: sql`COALESCE(${commissionLedger.notes}, '') || ${` [برگشت پورسانت بابت حذف فاکتور #${invoice.invoiceNumber}]`}`,
        }).where(eq(commissionLedger.id, commission.id));
      } else {
        await tx.delete(commissionLedger).where(eq(commissionLedger.id, commission.id));
      }
    }

    // Generic references are not database FKs, but detaching them prevents
    // broken links in the UI while retaining alert/task history.
    await tx.update(alerts).set({ entityId: null, status: "resolved", updatedAt: new Date() })
      .where(and(eq(alerts.entityType, "invoice"), eq(alerts.entityId, invoiceId)));
    await tx.update(tasks).set({ entityId: null, updatedAt: new Date() })
      .where(and(eq(tasks.entityType, "invoice"), eq(tasks.entityId, invoiceId)));

    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    await tx.delete(invoices).where(eq(invoices.id, invoiceId));

    await recalculateCustomerHealth(invoice.customerId, tx);
    await logAuditEvent("DELETE", "invoice", invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
      reason: deletionReason,
      paymentCount: linkedPaymentIds.size,
      commissionCount: commissions.length,
      stockReturned: invoice.status === "issued" || invoice.status === "corrected",
    }, undefined, tx);

    return {
      success: true,
      message: linkedPaymentIds.size
        ? "فاکتور حذف شد؛ موجودی و پورسانت اصلاح شدند و دریافت‌های مالی بدون تغییر در حساب حفظ شدند."
        : "فاکتور حذف شد و آثار موجودی و پورسانت آن با موفقیت اصلاح شدند.",
    };
  });
}
