import type { Transaction } from "./product";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuditContext {
  userId?: string;
  userName?: string;
  ipAddress?: string;
}

const SENSITIVE_KEY = /(password|passwordhash|token|cookie|api[_-]?key|session|secret|authorization)/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(child)]));
}

export async function logAuditEvent(
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
  context?: AuditContext,
  client: Transaction | typeof db = db
) {
  try {
    const validEntityId = entityId && UUID_REGEX.test(entityId) ? entityId : null;
    const finalDetails = redact({ ...(details || {}) }) as Record<string, unknown>;
    if (entityId && !validEntityId) {
      finalDetails.rawEntityId = entityId;
    }

    await client.insert(auditLogs).values({
      action,
      entityType,
      entityId: validEntityId,
      projectId: typeof finalDetails.projectId === "string" && UUID_REGEX.test(finalDetails.projectId) ? finalDetails.projectId : null,
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
