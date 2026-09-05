import { ApiError } from "@/lib/apiError";
import crypto from "node:crypto";
import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { commissionLedger, employees, accounts, expenses, payments } from "@/db/schema";
import { desc, eq, and, sql, or } from "drizzle-orm";
import { requirePermission } from "@/services/access";
import { logAuditEvent } from "@/services/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const viewer = await requirePermission("commissions.view");
    if (!viewer.permissions.has("*") && !viewer.permissions.has("commissions.manage") && viewer.employeeId !== id) throw new ApiError(403, "دسترسی به پورسانت همکار دیگر مجاز نیست.");

    const [emp] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp) {
      return NextResponse.json({ success: false, error: "همکار مورد نظر یافت نشد" }, { status: 404 });
    }

    const commissions = await db
      .select()
      .from(commissionLedger)
      .where(or(eq(commissionLedger.employeeId, id), eq(commissionLedger.recipientEmployeeId, id)))
      .orderBy(desc(commissionLedger.createdAt));

    let totalEarned = 0;
    let totalPaid = 0;

    for (const c of commissions) {
      const amt = Number(c.commissionAmount) || 0;
      if (c.commissionType === "payout" || amt < 0) {
        totalPaid += Math.abs(amt);
      } else if (c.status !== "reversed") {
        totalEarned += amt;
      }
    }

    const balancePending = Math.max(0, totalEarned - totalPaid);

    const availableAccounts = await db.select().from(accounts);

    return NextResponse.json({
      success: true,
      employee: emp,
      commissions,
      summary: {
        totalEarned,
        totalPaid,
        balancePending,
      },
      accounts: availableAccounts.map((a) => ({
        ...a,
        balance: Number(a.balance),
      })),
    });
  } catch (e: any) {
    return apiError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const body = await req.json();
    await requirePermission("commissions.manage");

    return await db.transaction(async (tx) => {
    const [emp] = await tx.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp) {
      return NextResponse.json({ success: false, error: "همکار مورد نظر یافت نشد" }, { status: 404 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: "مبلغ پرداختی نامعتبر است و باید بزرگتر از صفر باشد." }, { status: 400 });
    }

    if (!body.accountId) {
      return NextResponse.json({ success: false, error: "انتخاب حساب بانکی یا صندوق پرداخت الزامی است." }, { status: 400 });
    }

    const [account] = await tx.select().from(accounts).where(eq(accounts.id, body.accountId)).for("update").limit(1);
    if (!account) {
      return NextResponse.json({ success: false, error: "حساب بانکی مورد نظر یافت نشد." }, { status: 404 });
    }

    const currentAccBalance = Number(account.balance) || 0;
    if (currentAccBalance < amount) {
      return NextResponse.json(
        {
          success: false,
          error: `موجودی حساب "${account.name}" کافی نیست. موجودی فعلی: ${currentAccBalance.toLocaleString("fa-IR")} تومان، مبلغ پرداختی: ${amount.toLocaleString("fa-IR")} تومان. موجودی حساب‌ها نمی‌تواند منفی شود.`,
        },
        { status: 400 }
      );
    }

    const newAccBalance = currentAccBalance - amount;
    const expNum = `EXP-COMM-${crypto.randomUUID()}`;
    const payNum = `PAY-COMM-${crypto.randomUUID()}`;
    const refNumber = body.referenceNumber || null;
    const notes = body.notes || `پرداخت پورسانت به ${emp.name}`;

    // 1. Deduct money from account balance
    await tx
      .update(accounts)
      .set({
        balance: newAccBalance.toString(),
      })
      .where(eq(accounts.id, account.id));

    // 2. Record Expense in expenses table
    const [createdExpense] = await tx
      .insert(expenses)
      .values({
        expenseNumber: expNum,
        category: "commission",
        amount: amount.toString(),
        employeeId: emp.id,
        accountId: account.id,
        projectId: body.projectId || null,
        title: `پرداخت پورسانت همکار: ${emp.name}`,
        description: `بابت تسویه پورسانت فروش / ویزیتوری - کد پیگیری: ${refNumber || "ندارد"} - ${notes}`,
        expenseDate: new Date(),
      })
      .returning();

    // 3. Record Payment in payments table
    const [createdPayment] = await tx
      .insert(payments)
      .values({
        paymentNumber: payNum,
        accountId: account.id,
        amount: amount.toString(),
        paymentType: "commission_payout",
        paymentMethod: body.paymentMethod || "bank_transfer",
        referenceNumber: refNumber,
        notes: `تسویه پورسانت ${emp.name} - سند هزینه #${expNum}`,
        status: "completed",
      })
      .returning();

    // 4. Record in Commission Ledger as a Payout entry
    const [createdLedger] = await tx
      .insert(commissionLedger)
      .values({
        employeeId: emp.id,
        recipientEmployeeId: emp.id,
        commissionType: "payout",
        baseAmount: amount.toString(),
        commissionAmount: (-amount).toString(), // Negative to deduct from pending balance
        status: "paid",
        paymentId: createdPayment.id,
        ruleSnapshot: {
          payoutType: "manual_commission_payout",
          expenseNumber: expNum,
          paymentNumber: payNum,
          paymentMethod: body.paymentMethod || "bank_transfer",
          referenceNumber: refNumber,
          accountName: account.name,
        },
        notes: `پرداخت نقدی/بانکی پورسانت: ${notes}`,
      })
      .returning();

    await logAuditEvent("COMMISSION_PAYOUT", "commission_ledger", createdLedger.id, {
      employeeId: emp.id,
      employeeName: emp.name,
      amount,
      accountId: account.id,
      accountName: account.name,
      expenseNumber: expNum,
      paymentNumber: payNum,
    });

    return NextResponse.json({
      success: true,
      message: `پرداخت پورسانت به مبلغ ${amount.toLocaleString("fa-IR")} تومان با موفقیت ثبت شد و سند هزینه #${expNum} صادر گردید.`,
      expense: createdExpense,
      payment: createdPayment,
      ledger: createdLedger,
    });
    });
  } catch (e: any) {
    return apiError(e);
  }
}
