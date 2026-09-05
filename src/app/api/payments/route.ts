import { pageNumber } from "@/lib/apiError";
import crypto from "node:crypto";
import { ApiError, assertUuid, decimal } from "@/lib/apiError";
import { requestIdentity } from "@/lib/idempotency";
import { apiError } from "@/lib/apiError";
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
    const page = pageNumber(searchParams.get("page"), 1);
    const pageSize = pageNumber(searchParams.get("pageSize"), 20, 100);
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
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const context = await requirePermission("payments.create", body.projectId || null);

    assertUuid(body.accountId);
    for (const field of ["customerId", "invoiceId", "projectId"]) if (body[field]) assertUuid(body[field]);
    const amt = Number(decimal(body.amount, "مبلغ پرداخت", 2, true));
    if (body.paymentType && body.paymentType !== "customer_receipt") throw new ApiError(400, "این مسیر مخصوص ثبت دریافت مشتری است.");
    const payNum = `PAY-${crypto.randomUUID()}`;
    const identity = requestIdentity(req, context.employeeId, body);
    const manager = context.permissions.has("*") || ["admin", "manager"].includes(context.roleCode || "") || context.permissions.has("payments.manage");

    const created = await db.transaction(async (tx) => {
      if (identity.requestKey) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${identity.requestKey}, 0))`);
        const [prior] = await tx.select().from(payments).where(eq(payments.requestKey, identity.requestKey)).limit(1);
        if (prior) {
          if (prior.requestHash !== identity.requestHash) throw new ApiError(409, "کلید درخواست با اطلاعات دیگری استفاده شده است.");
          return prior;
        }
      }
      if (body.invoiceId) {
        const [inv] = await tx.select().from(invoices).where(eq(invoices.id, body.invoiceId)).for("update").limit(1);
        if (!inv) throw new ApiError(404, "فاکتور یافت نشد.");
        if (!manager && inv.employeeId !== context.employeeId) throw new ApiError(403, "این فاکتور متعلق به شما نیست.");
        await requirePermission("payments.create", inv.projectId);
        if (inv.status === "cancelled" || inv.status === "reversed") throw new ApiError(409, "ثبت پرداخت برای فاکتور باطل‌شده مجاز نیست.");
        if ((body.customerId && body.customerId !== inv.customerId) || (body.projectId && body.projectId !== inv.projectId)) throw new ApiError(400, "مشتری یا پروژه پرداخت با فاکتور یکسان نیست.");
        body.customerId = inv.customerId;
        body.projectId = inv.projectId;
        if (amt > Number(inv.grandTotal) - Number(inv.paidAmount)) throw new ApiError(409, "پرداخت از مانده فاکتور بیشتر است.");
      } else if (!manager) {
        if (!body.customerId) throw new ApiError(400, "مشتری الزامی است.");
        const [customer] = await tx.select().from(customers).where(eq(customers.id, body.customerId)).limit(1);
        if (!customer || customer.assignedEmployeeId !== context.employeeId) throw new ApiError(403, "دسترسی به این مشتری مجاز نیست.");
      }
      const [acc] = await tx.select().from(accounts).where(eq(accounts.id, body.accountId)).for("update").limit(1);
      if (!acc) throw new Error("حساب مالی یافت نشد.");

      const [row] = await tx
        .insert(payments)
        .values({
          paymentNumber: payNum,
          ...identity,
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
      if (body.customerId) await recalculateCustomerHealth(body.customerId, tx);
      return row;
    });


    await logAuditEvent("CREATE", "payment", created.id, { amount: amt, paymentNumber: payNum });
    return NextResponse.json({ success: true, payment: created });
  } catch (error: any) {
    return apiError(error);
  }
}
