import { apiError } from "@/lib/apiError";
import { pageNumber } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { expenses, accounts, projects } from "@/db/schema";
import { desc, eq, sql, and } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    
    const context = await requirePermission("expenses.view", projectId || undefined);

    const page = pageNumber(searchParams.get("page"), 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)));
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (projectId && projectId.trim() !== "") {
      conditions.push(eq(expenses.projectId, projectId));
    }

    const list = await db
      .select({
        expense: expenses,
        accountName: accounts.name,
        projectName: projects.name,
      })
      .from(expenses)
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
      .limit(pageSize)
      .offset(offset);

    let total = list.length;
    try {
      const countRes = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(expenses)
        .where(conditions.length ? and(...conditions) : undefined);
      total = Number(countRes[0]?.count ?? list.length);
    } catch {
      total = list.length;
    }

    const formatted = list.map(({ expense, accountName, projectName }) => ({
      ...expense,
      accountName: accountName || "-",
      projectName: projectName || "عمومی",
      amount: Number(expense.amount),
    }));

    return NextResponse.json({ success: true, expenses: formatted, pagination: { page, pageSize, total } });
  } catch (error: any) {
    console.error("GET /api/expenses error:", error);
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const context = await requirePermission("expenses.create", body.projectId || null);

    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ success: false, error: "عنوان هزینه الزامی است." }, { status: 400 });
    }

    const amt = Number(body.amount);
    if (!amt || amt <= 0 || !isFinite(amt)) {
      return NextResponse.json({ success: false, error: "مبلغ هزینه باید بزرگ‌تر از صفر باشد." }, { status: 400 });
    }

    const category = body.category || "other";

    // Ensure we have a valid accountId
    let accountId = body.accountId;
    if (!accountId || accountId.trim() === "") {
      // Find default account or first available account
      const [defAcc] = await db
        .select()
        .from(accounts)
        .orderBy(desc(accounts.isDefault), desc(accounts.createdAt))
        .limit(1);

      if (defAcc) {
        accountId = defAcc.id;
      } else {
        // Create an initial default cash account if none exists
        const [newAcc] = await db
          .insert(accounts)
          .values({
            code: `ACC-${Date.now().toString().slice(-4)}`,
            name: "صندوق نقدینگی مرکزی",
            type: "cash",
            balance: "10000000",
            isDefault: true,
          })
          .returning();
        accountId = newAcc.id;
      }
    }

    const expNum = `EXP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const created = await db.transaction(async (tx) => {
      const [acc] = await tx.select().from(accounts).where(eq(accounts.id, accountId)).for("update").limit(1);
      if (!acc) {
        throw new Error("حساب مالی انتخاب شده یافت نشد.");
      }

      // Deduct expense from account balance
      await tx
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${amt}`,
        })
        .where(eq(accounts.id, accountId));

      const [res] = await tx
        .insert(expenses)
        .values({
          expenseNumber: expNum,
          title: body.title.trim(),
          category: category,
          amount: amt.toString(),
          projectId: body.projectId && body.projectId.trim() !== "" ? body.projectId : null,
          accountId: accountId,
          employeeId: context?.employeeId || null,
          description: body.description?.trim() || body.notes?.trim() || null,
          expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
        })
        .returning();

      return res;
    });

    try {
      await logAuditEvent("CREATE", "expense", created.id, {
        title: body.title,
        amount: amt,
        accountId: accountId,
        projectId: body.projectId || null,
      }, { userId: context?.employeeId || "system", userName: context?.roleCode || "کاربر سیستم" });
    } catch {}

    return NextResponse.json({ success: true, expense: created, message: "سند هزینه با موفقیت ثبت شد." });
  } catch (error: any) {
    console.error("POST /api/expenses error:", error);
    return apiError(error);
  }
}

