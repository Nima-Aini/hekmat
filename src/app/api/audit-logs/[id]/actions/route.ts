import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { ApiError, apiError, assertUuid } from "@/lib/apiError";
import { requireAuditManager } from "@/services/access";
import { reverseInvoice } from "@/services/invoice";
import { cancelOrder } from "@/services/order";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const actor = await requireAuditManager();
    const [parent] = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
    if (!parent) throw new ApiError(404, "رویداد تاریخچه یافت نشد.");
    if (!parent.entityId) throw new ApiError(409, "این رویداد به رکورد قابل مدیریت متصل نیست.");

    const body = await req.json();
    const action = String(body.action || "");
    const reason = String(body.reason || "").trim() || "اقدام مدیر از بخش تاریخچه فعالیت‌ها";
    const auditContext = { userId: actor.employeeId, userName: actor.employeeName, parentLogId: parent.id, source: "audit_log" };

    if (parent.entityType === "invoice" && action === "reverse") {
      await reverseInvoice(parent.entityId, reason, auditContext);
    } else if (parent.entityType === "order" && action === "cancel") {
      await cancelOrder(parent.entityId, reason, auditContext);
    } else {
      throw new ApiError(400, "این عملیات برای نوع رکورد انتخاب‌شده پشتیبانی نمی‌شود.");
    }

    const [createdLog] = await db.select().from(auditLogs).where(eq(auditLogs.parentLogId, parent.id)).orderBy(desc(auditLogs.createdAt)).limit(1);
    return NextResponse.json({ success: true, log: createdLog, message: action === "reverse" ? "فاکتور با حفظ زنجیره تاریخچه ابطال شد." : "سفارش با حفظ زنجیره تاریخچه لغو شد." });
  } catch (error) {
    return apiError(error);
  }
}
