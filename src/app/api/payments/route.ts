import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments, accounts, customers, invoices, projects } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { recalculateCustomerHealth } from "@/services/customerHealth";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    await requirePermission("payments.view");
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const offset = (page - 1) * pageSize;
    const list = await db
      .select({
        payment: payments,
        accountName: accounts.name,
        customerName: customers.name,
        invoiceNumber: invoices.invoiceNumber,
        projectName: projects.name,
      })
      .from(payments)
      .innerJoin(accounts, eq(payments.accountId, accounts.id))
      .leftJoin(customers, eq(payments.customerId, customers.id))
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(projects, eq(payments.projectId, projects.id))
      .orderBy(desc(payments.createdAt))
      .limit(pageSize)
      .offset(offset);

    const formatted = list.map(({ payment, accountName, customerName, invoiceNumber, projectName }) => ({
      ...payment,
      accountName,
      customerName: customerName || "-",
      invoiceNumber: invoiceNumber || "-",
      projectName: projectName || "عمومی",
      amount: Number(payment.amount),
    }));

    return NextResponse.json({ success: true, payments: formatted, pagination: { page, pageSize } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const context = await requirePermission("payments.create", body.projectId || null);

    if (!body.accountId || !body.amount || Number(body.amount) <= 0) {
      return NextResponse.json({ success: false, error: "حساب مالی و مبلغ دریافتی الزامی است." }, { status: 400 });
    }

    const payNum = `PAY-${Date.now().toString().slice(-6)}`;
    let amt = Number(body.amount);
    if (body.invoiceId) {
      const [invForPayment] = await db.select({ grandTotal: invoices.grandTotal, paidAmount: invoices.paidAmount, balanceDue: invoices.balanceDue, customerId: invoices.customerId }).from(invoices).where(eq(invoices.id, body.invoiceId)).limit(1);
      if (!invForPayment) return NextResponse.json({ success:false, error:"فاکتور یافت نشد" }, { status:404 });
      const balance = Math.max(0, Number(invForPayment.grandTotal) - Number(invForPayment.paidAmount || 0));
      if (amt > balance) return NextResponse.json({ success:false, error:`مبلغ پرداخت بیشتر از مانده فاکتور است. مانده: ${balance.toLocaleString("fa-IR")} تومان` }, { status:400 });
      if (amt <= 0) return NextResponse.json({ success:false, error:"مبلغ پرداخت نامعتبر است." }, {status:400});
      if (!body.customerId) body.customerId = invForPayment.customerId;
    }
    const isManagerOrAdmin = !context || context.permissions.has("*") || context.roleCode === "admin" || context.roleCode === "manager" || context.permissions.has("payments.manage") || context.permissions.has("invoices.manage");
    if (!isManagerOrAdmin && context && body.invoiceId) {
      const [ownedInvoice] = await db.select({ employeeId: invoices.employeeId, customerId: invoices.customerId, projectId: invoices.projectId }).from(invoices).where(eq(invoices.id, body.invoiceId)).limit(1);
      if (!ownedInvoice) return NextResponse.json({ success: false, error: "فاکتور یافت نشد" }, { status: 404 });
      if (ownedInvoice.employeeId && ownedInvoice.employeeId !== context.employeeId) {
        return NextResponse.json({ success: false, error: "این فاکتور متعلق به شما نیست" }, { status: 403 });
      }
      if (ownedInvoice.projectId && body.projectId && ownedInvoice.projectId !== body.projectId) {
        return NextResponse.json({ success: false, error: "پروژه فاکتور و پرداخت یکسان نیست" }, { status: 400 });
      }
    }

    const created = await db.transaction(async (tx) => {
      if (body.invoiceId) {
        const [lockedInv] = await tx.select().from(invoices).where(eq(invoices.id, body.invoiceId)).for("update").limit(1);
        if (lockedInv) {
          const balance = Math.max(0, Number(lockedInv.grandTotal) - Number(lockedInv.paidAmount || 0));
          if (amt > balance) throw new Error(`مبلغ پرداخت بیشتر از مانده فاکتور است. مانده: ${balance.toLocaleString("fa-IR")} تومان`);
        }
      }
      const [acc] = await tx.select().from(accounts).where(eq(accounts.id, body.accountId)).for("update").limit(1);
      if (!acc) throw new Error("حساب مالی یافت نشد.");

      const [row] = await tx
        .insert(payments)
        .values({
          paymentNumber: payNum,
          customerId: body.customerId || null,
          invoiceId: body.invoiceId || null,
          projectId: body.projectId || null,
          accountId: body.accountId,
          paymentType: body.paymentType || "customer_receipt",
          amount: amt.toString(),
          paymentMethod: body.paymentMethod || "pos",
          referenceNumber: body.referenceNumber || null,
          notes: body.notes || null,
          status: "completed",
        })
        .returning();

      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${amt}` })
        .where(eq(accounts.id, body.accountId));

      if (body.invoiceId) {
        const [inv] = await tx.select().from(invoices).where(eq(invoices.id, body.invoiceId)).limit(1);
        if (inv) {
          const currentPaid = Number(inv.paidAmount) || 0;
          const gTotal = Number(inv.grandTotal) || 0;
          const newPaid = currentPaid + amt;
          const newBalance = Math.max(0, gTotal - newPaid);
          const newStatus = newBalance === 0 ? "paid" : "partial";
          await tx
            .update(invoices)
            .set({ paidAmount: newPaid.toString(), balanceDue: newBalance.toString(), paymentStatus: newStatus, updatedAt: new Date() })
            .where(eq(invoices.id, body.invoiceId));
        }
      }
      return row;
    });

    if (body.customerId) {
      await recalculateCustomerHealth(body.customerId);
    }

    await logAuditEvent("CREATE", "payment", created.id, { amount: amt, paymentNumber: payNum });
    return NextResponse.json({ success: true, payment: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
