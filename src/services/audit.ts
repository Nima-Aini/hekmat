import type { Transaction } from "./product";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuditContext {
  userId?: string;
  userName?: string;
  ipAddress?: string;
}

export async function logAuditEvent(
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, any>,
  context?: AuditContext,
  client: Transaction | typeof db = db
) {
  try {
    const validEntityId = entityId && UUID_REGEX.test(entityId) ? entityId : null;
    const finalDetails = { ...(details || {}) };
    if (entityId && !validEntityId) {
      finalDetails.rawEntityId = entityId;
    }

    await client.insert(auditLogs).values({
      action,
      entityType,
      entityId: validEntityId,
      userId: context?.userId || "system_user",
      userName: context?.userName || "کاربر سیستم",
      details: {
        ...finalDetails,
        ...(context?.ipAddress ? { ipAddress: context.ipAddress } : {}),
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
    if (client !== db) throw err;
  }
}
