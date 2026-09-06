import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { accounts, commissionLedger, customers, employees, expenses, invoices, payments, projects } from "@/db/schema";
import { ApiError, apiError, assertUuid } from "@/lib/apiError";
import { requirePermission } from "@/services/access";
import { logAuditEvent } from "@/services/audit";

const eligibleStatuses = new Set(["calculated", "pending", "payable"]);
type CommissionRow = typeof commissionLedger.$inferSelect;

function legacyCoveredCommissionIds(rows: CommissionRow[]) {
  let remaining = rows.reduce((sum, row) => {
    const amount = Number(row.commissionAmount) || 0;
    return row.commissionType === "payout" || amount < 0 ? sum + Math.abs(amount) : sum;
  }, 0);
  const covered = new Set<string>();
  const oldestFirst = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const row of oldestFirst) {
    const amount = Number(row.commissionAmount) || 0;
    if (remaining <= 0) break;
    if (amount <= 0 || row.commissionType === "payout" || row.status === "reversed" || row.status === "paid" || row.paymentId) continue;
    covered.add(row.id);
    remaining -= Math.min(remaining, amount);
  }
  return covered;
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
    const legacyCovered = legacyCoveredCommissionIds(ledgerRows);
    let totalEarned = 0, legacyPaid = 0, selectedRowsPaid = 0;
    const commissions = rows.map(({ commission, ...details }) => {
      const amount = Number(commission.commissionAmount) || 0;
      const isLegacyPayout = commission.commissionType === "payout" || amount < 0;
      if (isLegacyPayout) legacyPaid += Math.abs(amount);
      else if (commission.status !== "reversed") {
        totalEarned += amount;
        if (commission.status === "paid" || commission.paymentId) selectedRowsPaid += amount;
      }
      return {
        ...commission,
        ...details,
        storeName: details.storeName || details.customerName || null,
        legacyCovered: legacyCovered.has(commission.id),
        eligibleForPayout: !legacyCovered.has(commission.id) && !isLegacyPayout && amount > 0 && !commission.paymentId && eligibleStatuses.has(commission.status),
      };
    });

    const totalPaid = legacyPaid + selectedRowsPaid;
    const balancePending = Math.max(0, totalEarned - totalPaid);
    const availableAccounts = await db.select().from(accounts).where(eq(accounts.status, "active"));
    return NextResponse.json({
      success: true,
      employee: emp,
      commissions,
      summary: { totalEarned, totalPaid, balancePending },
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
      const legacyCovered = legacyCoveredCommissionIds(employeeLedger);
      for (const row of selected) {
        const amount = Number(row.commissionAmount);
        if (
          (row.employeeId !== id && row.recipientEmployeeId !== id) ||
          row.commissionType === "payout" ||
          row.status === "reversed" ||
          row.status === "paid" ||
          Boolean(row.paymentId) ||
          legacyCovered.has(row.id) ||
          !eligibleStatuses.has(row.status) ||
          !Number.isFinite(amount) ||
          amount <= 0
        ) throw new ApiError(409, "یک یا چند پورسانت انتخاب‌شده قبلاً پرداخت شده یا قابل پرداخت نیست.");
      }

      const amount = selected.reduce((sum, row) => sum + Number(row.commissionAmount), 0);
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
      await tx.update(commissionLedger).set({ status: "paid", paymentId: payment.id })
        .where(inArray(commissionLedger.id, commissionIds));
      await logAuditEvent("COMMISSION_PAYOUT", "commission_ledger", selected[0].id, {
        employeeId: emp.id, commissionIds, invoiceIds: selected.map((row) => row.invoiceId).filter(Boolean),
        amount, accountId: account.id, expenseNumber, paymentNumber,
      }, undefined, tx);
      return { amount, payment, expense, commissionIds };
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
