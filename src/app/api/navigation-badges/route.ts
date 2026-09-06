import { and, count, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { alerts, orders, tasks } from "@/db/schema";
import { ApiError, apiError } from "@/lib/apiError";
import { getEmployeeContext } from "@/services/access";

export async function GET() {
  try {
    const context = await getEmployeeContext();
    if (!context) throw new ApiError(401, "ابتدا وارد حساب کاربری شوید.");
    const global = context.permissions.has("*");
    const [orderRows, noteRows, alertRows] = await Promise.all([
      global || context.permissions.has("orders.view") ? db.select({ total: count() }).from(orders).where(and(inArray(orders.status, ["open", "ready"]), global ? undefined : eq(orders.employeeId, context.employeeId))) : Promise.resolve([{ total: 0 }]),
      global || context.permissions.has("notes.view") ? db.select({ total: count() }).from(tasks).where(and(eq(tasks.entityType, "note"), eq(tasks.status, "pending"))) : Promise.resolve([{ total: 0 }]),
      global || context.permissions.has("alerts.view") ? db.select({ total: count() }).from(alerts).where(inArray(alerts.status, ["new", "active", "in_review"])) : Promise.resolve([{ total: 0 }]),
    ]);
    return NextResponse.json({ success: true, badges: { orders: Number(orderRows[0]?.total || 0), notes: Number(noteRows[0]?.total || 0), alerts: Number(alertRows[0]?.total || 0) } });
  } catch (error) { return apiError(error); }
}
