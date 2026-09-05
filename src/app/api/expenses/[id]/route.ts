import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { expenses, accounts, projects } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    await requirePermission("expenses.view");

    const [expense] = await db
      .select({
        expense: expenses,
        accountName: accounts.name,
        projectName: projects.name,
      })
      .from(expenses)
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .where(eq(expenses.id, id))
      .limit(1);

    if (!expense) {
      return NextResponse.json({ success: false, error: "سند هزینه یافت نشد." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      expense: {
        ...expense.expense,
        accountName: expense.accountName || "-",
        projectName: expense.projectName || "عمومی",
        amount: Number(expense.expense.amount),
      },
    });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return apiError(error);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const body = await req.json();
    const context = await requirePermission("expenses.edit");

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(expenses).where(eq(expenses.id, id)).limit(1);
      if (!existing) {
        throw new Error("سند هزینه یافت نشد.");
      }

      const oldAmount = Number(existing.amount) || 0;
      const newAmount = body.amount !== undefined ? Number(body.amount) : oldAmount;
      if (newAmount <= 0 || !isFinite(newAmount)) {
        throw new Error("مبلغ هزینه نامعتبر است.");
      }

      const oldAccountId = existing.accountId;
      const newAccountId = body.accountId !== undefined ? (body.accountId || null) : oldAccountId;

      if (oldAccountId === newAccountId && newAccountId) {
        const diff = newAmount - oldAmount;
        if (diff > 0) {
          // Increasing expense amount: check if account has enough balance
          const [acc] = await tx.select().from(accounts).where(eq(accounts.id, newAccountId)).for("update").limit(1);
          if (!acc) throw new Error("حساب مالی یافت نشد.");
          const currentBalance = Number(acc.balance) || 0;
          if (currentBalance < diff) {
            throw new Error(
              `موجودی حساب «${acc.name}» کافی نیست. موجودی فعلی: ${currentBalance.toLocaleString("fa-IR")} تومان، افزایش مورد نیاز: ${diff.toLocaleString("fa-IR")} تومان.`
            );
          }
        }
        // For diff < 0 (decreasing expense), balance increases so no check needed
        // For diff === 0, no change needed
        if (diff !== 0) {
          await tx
            .update(accounts)
            .set({ balance: sql`${accounts.balance} - ${diff}` })
            .where(eq(accounts.id, newAccountId));
        }
      } else {
        if (oldAccountId) {
          // Use FOR UPDATE to prevent race conditions
          const [oldAcc] = await tx.select().from(accounts).where(eq(accounts.id, oldAccountId)).for("update").limit(1);
          if (oldAcc) {
            await tx
              .update(accounts)
              .set({ balance: sql`${accounts.balance} + ${oldAmount}` })
              .where(eq(accounts.id, oldAccountId));
          }
        }
        if (newAccountId) {
          const [newAcc] = await tx.select().from(accounts).where(eq(accounts.id, newAccountId)).for("update").limit(1);
          if (!newAcc) throw new Error("حساب جدید یافت نشد.");
          const newBalance = Number(newAcc.balance) || 0;
          if (newBalance < newAmount) {
            throw new Error(
              `موجودی حساب جدید «${newAcc.name}» کافی نیست. موجودی فعلی: ${newBalance.toLocaleString("fa-IR")} تومان، مبلغ هزینه: ${newAmount.toLocaleString("fa-IR")} تومان.`
            );
          }
          await tx
            .update(accounts)
            .set({ balance: sql`${accounts.balance} - ${newAmount}` })
            .where(eq(accounts.id, newAccountId));
        }
      }

      const updatePayload: Record<string, any> = { updatedAt: new Date() };
      if (body.title !== undefined) updatePayload.title = body.title.trim();
      if (body.category !== undefined) updatePayload.category = body.category;
      if (body.amount !== undefined) updatePayload.amount = newAmount.toString();
      if (body.projectId !== undefined) updatePayload.projectId = body.projectId || null;
      if (body.accountId !== undefined) updatePayload.accountId = newAccountId;
      if (body.description !== undefined) updatePayload.description = body.description || null;
      if (body.expenseDate !== undefined) updatePayload.expenseDate = new Date(body.expenseDate);

      const [res] = await tx.update(expenses).set(updatePayload).where(eq(expenses.id, id)).returning();
      return { updatedRecord: res, oldAmount, newAmount };
    });

    await logAuditEvent("UPDATE", "expense", id, {
      title: updated.updatedRecord.title,
      oldAmount: updated.oldAmount,
      newAmount: updated.newAmount,
      accountId: updated.updatedRecord.accountId,
    }, { userId: context.employeeId, userName: context.roleCode });

    return NextResponse.json({
      success: true,
      expense: updated.updatedRecord,
      message: `سند هزینه «${updated.updatedRecord.title}» با موفقیت ویرایش شد.`,
    });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : error.message?.includes("موجودی") ? 400 : 500;
    return apiError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const context = await requirePermission("expenses.delete");

    const deleted = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(expenses).where(eq(expenses.id, id)).limit(1);
      if (!existing) {
        throw new Error("سند هزینه یافت نشد.");
      }

      if (existing.accountId) {
        const amt = Number(existing.amount) || 0;
        await tx
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${amt}` })
          .where(eq(accounts.id, existing.accountId));
      }

      await tx.delete(expenses).where(eq(expenses.id, id));
      return existing;
    });

    await logAuditEvent("DELETE", "expense", id, {
      title: deleted.title,
      amount: deleted.amount,
      accountId: deleted.accountId,
    }, { userId: context.employeeId, userName: context.roleCode });

    return NextResponse.json({
      success: true,
      message: `سند هزینه «${deleted.title}» با موفقیت ابطال شد و مبلغ آن به موجودی حساب بازگردانده گردید.`,
    });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return apiError(error);
  }
}
