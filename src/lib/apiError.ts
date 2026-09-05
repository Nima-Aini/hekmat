import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type PostgreSqlError = {
  code?: unknown;
  constraint?: unknown;
  table?: unknown;
  detail?: unknown;
  message?: unknown;
};

function postgresError(error: unknown): PostgreSqlError | null {
  let current: unknown = error;
  const visited = new Set<unknown>();
  for (let depth = 0; current && depth < 8 && !visited.has(current); depth++) {
    visited.add(current);
    if (typeof current === "object") {
      const candidate = current as PostgreSqlError & { cause?: unknown };
      if (typeof candidate.code === "string" && /^\d{5}$/.test(candidate.code)) return candidate;
      current = candidate.cause;
    } else break;
  }
  return null;
}

export function apiError(error: unknown, operation = "انجام عملیات") {
  if (error instanceof ApiError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  const pg = postgresError(error);
  const code = typeof pg?.code === "string" ? pg.code : undefined;
  // PostgreSQL metadata is useful on the server, but SQL text and parameters
  // must never be reflected to the browser.
  if (pg) {
    console.error("PostgreSQL operation failed:", {
      operation,
      code,
      constraint: pg.constraint,
      table: pg.table,
      detail: pg.detail,
      message: pg.message,
    });
  } else {
    console.error("API operation failed:", { operation, error });
  }
  const status = code === "23505" || code === "23503" ? 409 : error instanceof SyntaxError || code === "22P02" || code === "22003" ? 400 : 500;
  const message = code === "23505" ? "اطلاعات تکراری است؛ کد یا شماره دیگری انتخاب کنید." : code === "23503" ? "این رکورد دارای اطلاعات وابسته است و عملیات فعلی قابل انجام نیست." : status === 400 ? "اطلاعات ارسالی معتبر نیست." : `خطا در ${operation}؛ لطفاً دوباره تلاش کنید.`;
  return NextResponse.json({ success: false, error: message }, { status });
}

export function assertUuid(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, "شناسه ارسالی معتبر نیست.");
}

export function decimal(value: unknown, label: string, scale = 2, positive = false): string {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") throw new ApiError(400, `${label} معتبر نیست.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (positive && n === 0) || n >= 10 ** (15 - scale)) throw new ApiError(400, `${label} معتبر نیست.`);
  return n.toFixed(scale);
}

export function pageNumber(value: string | null, fallback: number, max = 1000000) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new ApiError(400, "شماره صفحه معتبر نیست.");
  return Math.min(Number(value), max);
}
