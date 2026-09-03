import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, payments, expenses } from "@/db/schema";
import { eq, desc, sql, and, ne } from "drizzle-orm";
import { requirePermission } from "@/services/access";
import { logAuditEvent } from "@/services/audit";

export async function GET(req: Request) {
  try {
    await requirePermission("financial.view");
    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    const conditions = [];
    if (type && type !== "all") {
      conditions.push(eq(accounts.type, type));
    }

    const rows = await db
      .select()
      .from(accounts)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(accounts.isDefault), desc(accounts.createdAt));

    const totalLiquidity = rows.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalBank = rows
      .filter((a) => a.type === "bank" || a.type === "pos")
      .reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalCash = rows
      .filter((a) => a.type === "cash")
      .reduce((sum, a) => sum + Number(a.balance || 0), 0);

    return NextResponse.json({
      success: true,
      accounts: rows.map((a) => ({
        ...a,
        balance: Number(a.balance || 0),
      })),
      summary: {
        totalLiquidity,
        totalBank,
        totalCash,
        count: rows.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("financial.edit");
    const body = await req.json();

    const { name, type = "bank", bankName, accountNumber, balance = 0, isDefault = false } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "نام حساب یا صندوق الزامی است." }, { status: 400 });
    }

    if (Number(balance) < 0) {
      return NextResponse.json({ success: false, error: "موجودی حساب نمی‌تواند منفی باشد." }, { status: 400 });
    }

    let code = body.code?.trim();
    if (!code) {
      const prefix = type === "cash" ? "CASH" : type === "pos" ? "POS" : "ACC";
      code = `${prefix}-${Date.now().toString().slice(-4)}`;
    }

    // Check duplicate code
    const [existingCode] = await db.select().from(accounts).where(eq(accounts.code, code)).limit(1);
    if (existingCode) {
      code = `${code}-${Math.floor(Math.random() * 100)}`;
    }

    // If set as default, unset other defaults
    if (isDefault) {
      await db.update(accounts).set({ isDefault: false });
    }

    const [newAccount] = await db
      .insert(accounts)
      .values({
        code,
        name: name.trim(),
        type,
        bankName: bankName?.trim() || null,
        accountNumber: accountNumber?.trim() || null,
        balance: String(balance || 0),
        isDefault: Boolean(isDefault),
      })
      .returning();

    await logAuditEvent("CREATE", "account", newAccount.id, {
      name: newAccount.name,
      code: newAccount.code,
      type: newAccount.type,
      balance: newAccount.balance,
    });

    return NextResponse.json({
      success: true,
      account: { ...newAccount, balance: Number(newAccount.balance || 0) },
      message: `حساب «${newAccount.name}» با موفقیت ایجاد گردید.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await requirePermission("financial.edit");
    const body = await req.json();
    const { id, name, code, type, bankName, accountNumber, balance, isDefault } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "شناسه حساب الزامی است." }, { status: 400 });
    }

    const [existing] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, error: "حساب مورد نظر یافت نشد." }, { status: 404 });
    }

    if (code && code !== existing.code) {
      const [duplicate] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.code, code), ne(accounts.id, id)))
        .limit(1);
      if (duplicate) {
        return NextResponse.json({ success: false, error: "کد حساب تکراری است." }, { status: 400 });
      }
    }

    if (isDefault) {
      await db.update(accounts).set({ isDefault: false }).where(ne(accounts.id, id));
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code.trim();
    if (type !== undefined) updateData.type = type;
    if (bankName !== undefined) updateData.bankName = bankName?.trim() || null;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber?.trim() || null;
    if (balance !== undefined) {
      if (Number(balance) < 0) {
        return NextResponse.json({ success: false, error: "موجودی حساب نمی‌تواند منفی باشد." }, { status: 400 });
      }
      updateData.balance = String(balance);
    }
    if (isDefault !== undefined) updateData.isDefault = Boolean(isDefault);

    const [updated] = await db.update(accounts).set(updateData).where(eq(accounts.id, id)).returning();

    await logAuditEvent("UPDATE", "account", updated.id, {
      name: updated.name,
      code: updated.code,
      balance: updated.balance,
      isDefault: updated.isDefault,
    });

    return NextResponse.json({
      success: true,
      account: { ...updated, balance: Number(updated.balance || 0) },
      message: `اطلاعات حساب «${updated.name}» با موفقیت ویرایش شد.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requirePermission("financial.delete");
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "شناسه حساب مشخص نشده است." }, { status: 400 });
    }

    // Check if payments or expenses use this account
    const [hasPayments] = await db.select().from(payments).where(eq(payments.accountId, id)).limit(1);
    if (hasPayments) {
      return NextResponse.json(
        { success: false, error: "امکان حذف این حساب وجود ندارد زیرا تراکنش‌های پرداختی/دریافتی به آن متصل است." },
        { status: 400 }
      );
    }

    const [hasExpenses] = await db.select().from(expenses).where(eq(expenses.accountId, id)).limit(1);
    if (hasExpenses) {
      return NextResponse.json(
        { success: false, error: "امکان حذف این حساب وجود ندارد زیرا رکوردهای هزینه جاری به آن متصل است." },
        { status: 400 }
      );
    }

    const [deleted] = await db.delete(accounts).where(eq(accounts.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ success: false, error: "حساب یافت نشد." }, { status: 404 });
    }

    await logAuditEvent("DELETE", "account", id, { name: deleted.name, code: deleted.code });

    return NextResponse.json({
      success: true,
      message: `حساب «${deleted.name}» با موفقیت حذف شد.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
