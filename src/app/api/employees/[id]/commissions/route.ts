import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { accounts, commissionLedger, commissionPaymentAllocations, customers, employees, expenses, invoices, payments, projects } from "@/db/schema";
import { ApiError, apiError, assertUuid } from "@/lib/apiError";
import { requirePermission } from "@/services/access";
import { logAuditEvent } from "@/services/audit";

type CommissionRow = typeof commissionLedger.$inferSelect;

function legacyCoverage(rows: CommissionRow[]) {
  let remaining = rows.reduce((sum, row) => {
    const amount = Number(row.commissionAmount) || 0;
    return row.commissionType === "payout" || amount < 0 ? sum + Math.abs(amount) : sum;
  }, 0);
  const covered = new Map<string, number>();
  const oldestFirst = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const row of oldestFirst) {
    const amount = Number(row.commissionAmount) || 0;
    if (remaining <= 0) break;
    if (amount <= 0 || row.commissionType === "payout" || row.status === "reversed" || row.status === "paid" || row.paymentId) continue;
    const applied = Math.min(remaining, amount);
    covered.set(row.id, applied);
    remaining -= applied;
  }
  return covered;
}

function collectionPayable(commissionAmount: number, invoiceTotal: unknown, invoicePaid: unknown, invoiceStatus: unknown) {
  if (invoiceStatus !== "issued" || commissionAmount <= 0) return 0;
  const total = Number(invoiceTotal) || 0;
  const paid = Math.max(0, Number(invoicePaid) || 0);
  if (total <= 0) return 0;
  return Math.min(commissionAmount, Math.round((commissionAmount * Math.min(1, paid / total)) * 100) / 100);
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const viewer = await requirePermission("commissions.view");
    if (!viewer.permissions.has("*") && !viewer.permissions.has("commissions.manage") && viewer.employeeId !== id) {
      throw new ApiError(403, "دسترسی به پورسانت همکار دیگر مجاز نیست.");
    }
    const [emp] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp) throw new ApiError(404, "همکار مورد نظر یافت نشد");

    const rows = await db.select({
      commission: commissionLedger,
      invoiceNumber: invoices.invoiceNumber,
      invoiceDate: invoices.invoiceDate,
      invoiceTotal: invoices.grandTotal,
      invoicePaidAmount: invoices.paidAmount,
      invoiceBalanceDue: invoices.balanceDue,
      invoicePaymentStatus: invoices.paymentStatus,
      invoiceStatus: invoices.status,
      storeName: customers.storeName,
      customerName: customers.name,
      projectName: projects.name,
      paymentNumber: payments.paymentNumber,
      paymentDate: payments.paymentDate,
    }).from(commissionLedger)
      .leftJoin(invoices, eq(commissionLedger.invoiceId, invoices.id))
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(projects, eq(commissionLedger.projectId, projects.id))
      .leftJoin(payments, eq(commissionLedger.paymentId, payments.id))
      .where(or(eq(commissionLedger.employeeId, id), eq(commissionLedger.recipientEmployeeId, id)))
      .orderBy(desc(commissionLedger.createdAt));

    const ledgerRows = rows.map((row) => row.commission);
    const allocationRows = ledgerRows.length ? await db.select().from(commissionPaymentAllocations)
      .where(inArray(commissionPaymentAllocations.commissionLedgerId, ledgerRows.map((row) => row.id))) : [];
    const allocatedByCommission = new Map<string, number>();
    for (const allocation of allocationRows) allocatedByCommission.set(
      allocation.commissionLedgerId,
      (allocatedByCommission.get(allocation.commissionLedgerId) || 0) + Number(allocation.amount || 0),
    );
    const legacyCovered = legacyCoverage(ledgerRows);
    let totalEarned = 0, legacyPaid = 0, selectedRowsPaid = 0, totalPayableByCollection = 0;
    const commissions = rows.map(({ commission, ...details }) => {
      const amount = Number(commission.commissionAmount) || 0;
      const isLegacyPayout = commission.commissionType === "payout" || amount < 0;
      if (isLegacyPayout) legacyPaid += Math.abs(amount);
      else if (commission.status !== "reversed") {
        totalEarned += amount;
        const allocated = allocatedByCommission.get(commission.id) || 0;
        if (allocated > 0) selectedRowsPaid += allocated;
        else if (commission.status === "paid" || commission.paymentId) selectedRowsPaid += amount;
      }
      const legacyAmount = legacyCovered.get(commission.id) || 0;
      const allocationAmount = allocatedByCommission.get(commission.id) || 0;
      const directlyPaidAmount = allocationAmount === 0 && (commission.status === "paid" || commission.paymentId) ? amount : 0;
      const alreadyPaidCommission = Math.min(Math.max(0, amount), allocationAmount + directlyPaidAmount + legacyAmount);
      const payableByCollection = collectionPayable(amount, details.invoiceTotal, details.invoicePaidAmount, details.invoiceStatus);
      const remainingPayable = Math.max(0, payableByCollection - alreadyPaidCommission);
      if (!isLegacyPayout && commission.status !== "reversed") totalPayableByCollection += payableByCollection;
      return {
        ...commission,
        ...details,
        storeName: details.storeName || details.customerName || null,
        commissionRate: Number(commission.baseAmount) > 0 ? (amount / Number(commission.baseAmount)) * 100 : 0,
        alreadyPaidCommission,
        payableByCollection,
        remainingPayable,
        legacyCovered: legacyAmount > 0,
        eligibleForPayout: !isLegacyPayout && amount > 0 && remainingPayable > 0 && commission.status !== "reversed",
      };
    });

    const totalPaid = legacyPaid + selectedRowsPaid;
    const remainingPayable = Math.max(0, totalPayableByCollection - totalPaid);
    const balancePending = Math.max(0, totalEarned - totalPaid);
    const availableAccounts = await db.select().from(accounts).where(eq(accounts.status, "active"));
    return NextResponse.json({
      success: true,
      employee: emp,
      commissions,
      summary: { totalEarned, totalPayableByCollection, totalPaid, remainingPayable, balancePending },
      accounts: availableAccounts.map((account) => ({ ...account, balance: Number(account.balance) })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    await requirePermission("commissions.manage");
    const body = await req.json();
    const commissionIds: string[] = Array.from(new Set<string>(Array.isArray(body.commissionIds) ? body.commissionIds.map(String) : []));
    if (commissionIds.length === 0) throw new ApiError(400, "حداقل یک پورسانت قابل پرداخت را انتخاب کنید.");
    if (commissionIds.length > 500) throw new ApiError(400, "حداکثر ۵۰۰ پورسانت را می‌توان در یک پرداخت تسویه کرد.");
    commissionIds.forEach(assertUuid);
    if (!body.accountId) throw new ApiError(400, "انتخاب حساب بانکی یا صندوق پرداخت الزامی است.");
    assertUuid(String(body.accountId));
    const allowedMethods = new Set(["bank_transfer", "card_transfer", "pos", "cash", "cheque"]);
    if (body.paymentMethod && !allowedMethods.has(body.paymentMethod)) throw new ApiError(400, "روش پرداخت نامعتبر است.");

    const result = await db.transaction(async (tx) => {
      const [emp] = await tx.select().from(employees).where(eq(employees.id, id)).limit(1);
      if (!emp) throw new ApiError(404, "همکار مورد نظر یافت نشد");
      const employeeLedger = await tx.select().from(commissionLedger)
        .where(or(eq(commissionLedger.employeeId, id), eq(commissionLedger.recipientEmployeeId, id)))
        .for("update");
      const selected = employeeLedger.filter((row) => commissionIds.includes(row.id));
      if (selected.length !== commissionIds.length) throw new ApiError(404, "یک یا چند پورسانت انتخاب‌شده یافت نشد.");
      const legacyCovered = legacyCoverage(employeeLedger);
      const selectedInvoiceIds = Array.from(new Set(selected.map((row) => row.invoiceId).filter((value): value is string => Boolean(value))));
      const invoiceRows = selectedInvoiceIds.length ? await tx.select({
        id: invoices.id,
        grandTotal: invoices.grandTotal,
        paidAmount: invoices.paidAmount,
        status: invoices.status,
      }).from(invoices).where(inArray(invoices.id, selectedInvoiceIds)).for("update") : [];
      const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
      const existingAllocations = await tx.select().from(commissionPaymentAllocations)
        .where(inArray(commissionPaymentAllocations.commissionLedgerId, commissionIds)).for("update");
      const allocatedByCommission = new Map<string, number>();
      for (const allocation of existingAllocations) allocatedByCommission.set(
        allocation.commissionLedgerId,
        (allocatedByCommission.get(allocation.commissionLedgerId) || 0) + Number(allocation.amount || 0),
      );
      const payoutAmounts = new Map<string, number>();
      for (const row of selected) {
        const amount = Number(row.commissionAmount);
        const invoice = row.invoiceId ? invoiceById.get(row.invoiceId) : null;
        const allocated = allocatedByCommission.get(row.id) || 0;
        const legacyAmount = legacyCovered.get(row.id) || 0;
        const directPaid = allocated === 0 && (row.status === "paid" || row.paymentId) ? amount : 0;
        const alreadyPaid = Math.min(Math.max(0, amount), allocated + legacyAmount + directPaid);
        const payable = invoice ? collectionPayable(amount, invoice.grandTotal, invoice.paidAmount, invoice.status) : 0;
        const remaining = Math.round(Math.max(0, payable - alreadyPaid) * 100) / 100;
        if (
          (row.employeeId !== id && row.recipientEmployeeId !== id) ||
          row.commissionType === "payout" ||
          row.status === "reversed" ||
          !Number.isFinite(amount) ||
          amount <= 0 ||
          remaining <= 0
        ) throw new ApiError(409, "یک یا چند پورسانت انتخاب‌شده بر اساس وصول مشتری، مبلغ قابل پرداخت ندارد یا قبلاً پرداخت شده است.");
        payoutAmounts.set(row.id, remaining);
      }

      const amount = Array.from(payoutAmounts.values()).reduce((sum, value) => sum + value, 0);
      const [account] = await tx.select().from(accounts)
        .where(and(eq(accounts.id, body.accountId), eq(accounts.status, "active"))).for("update").limit(1);
      if (!account) throw new ApiError(404, "حساب فعال مورد نظر یافت نشد.");
      const currentBalance = Number(account.balance) || 0;
      if (currentBalance < amount) throw new ApiError(400, `موجودی حساب «${account.name}» برای این پرداخت کافی نیست.`);

      const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
      if (Number.isNaN(paymentDate.getTime())) throw new ApiError(400, "تاریخ پرداخت نامعتبر است.");
      const expenseNumber = `EXP-COMM-${crypto.randomUUID()}`;
      const paymentNumber = `PAY-COMM-${crypto.randomUUID()}`;
      const referenceNumber = body.referenceNumber?.trim() || null;
      const notes = body.notes?.trim() || `پرداخت پورسانت ${selected.length} فروش به ${emp.name}`;

      await tx.update(accounts).set({ balance: (currentBalance - amount).toString() }).where(eq(accounts.id, account.id));
      const [payment] = await tx.insert(payments).values({
        paymentNumber, accountId: account.id, amount: amount.toString(),
        paymentType: "commission_payout", paymentMethod: body.paymentMethod || "bank_transfer",
        paymentDate, referenceNumber, notes, status: "completed",
      }).returning();
      const projectIds = Array.from(new Set(selected.map((row) => row.projectId).filter((value): value is string => Boolean(value))));
      const [expense] = await tx.insert(expenses).values({
        expenseNumber, category: "commission", amount: amount.toString(), employeeId: emp.id,
        accountId: account.id, projectId: projectIds.length === 1 ? projectIds[0] : null,
        title: `پرداخت پورسانت همکار: ${emp.name}`,
        description: `${notes} - سند پرداخت ${paymentNumber}${referenceNumber ? ` - پیگیری ${referenceNumber}` : ""}`,
        expenseDate: paymentDate,
      }).returning();
      await tx.insert(commissionPaymentAllocations).values(selected.map((row) => ({
        commissionLedgerId: row.id,
        paymentId: payment.id,
        amount: payoutAmounts.get(row.id)!.toString(),
      })));
      for (const row of selected) {
        const previousAllocated = allocatedByCommission.get(row.id) || 0;
        const newAllocated = previousAllocated + (payoutAmounts.get(row.id) || 0);
        const fullyPaid = newAllocated >= Number(row.commissionAmount) - 0.005;
        await tx.update(commissionLedger).set({
          status: fullyPaid ? "paid" : "payable",
          paymentId: fullyPaid && previousAllocated === 0 ? payment.id : null,
        }).where(eq(commissionLedger.id, row.id));
      }
      await logAuditEvent("COMMISSION_PAYOUT", "commission_ledger", selected[0].id, {
        employeeId: emp.id, commissionIds, invoiceIds: selected.map((row) => row.invoiceId).filter(Boolean),
        amount, accountId: account.id, expenseNumber, paymentNumber,
      }, undefined, tx);
      return { amount, payment, expense, commissionIds, allocations: Object.fromEntries(payoutAmounts) };
    });

    return NextResponse.json({
      success: true,
      message: `پورسانت ${result.commissionIds.length} فروش به مبلغ ${result.amount.toLocaleString("fa-IR")} تومان پرداخت شد.`,
      ...result,
    });
  } catch (error) {
    return apiError(error);
  }
}
