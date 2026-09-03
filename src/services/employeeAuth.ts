import crypto from "node:crypto";
import { db } from "@/db";
import { employees, employeeAccounts, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
declare global {
  var __akmaDevAuthSecret: string | undefined;
}
const secret = () => {
  const value = process.env.AUTH_SECRET || process.env.AUTH_SALT;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET در محیط Production تنظیم نشده است. لطفاً متغیر محیطی AUTH_SECRET را تنظیم کنید.");
  }
  // In development, generate a random secret per process instance for safety
  if (!globalThis.__akmaDevAuthSecret) {
    globalThis.__akmaDevAuthSecret = crypto.randomBytes(32).toString("hex");
  }
  return globalThis.__akmaDevAuthSecret;
};

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signSession(employeeId: string) {
  const payload = Buffer.from(`${employeeId}.${Date.now()}`).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const [id, ts] = Buffer.from(payload, "base64url").toString("utf8").split(".");
    if (!id || !ts) return null;
    const tokenAge = Date.now() - Number(ts);
    if (tokenAge > 12 * 60 * 60 * 1000 || tokenAge < 0) return null;
    return id;
  } catch {
    return null;
  }
}

export async function ensureDefaultAdminAccount() {
  const username = process.env.INITIAL_ADMIN_USERNAME;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn("⚠️ INITIAL_ADMIN_USERNAME یا INITIAL_ADMIN_PASSWORD تنظیم نشده است. حساب پیش‌فرض مدیر ایجاد نمی‌شود.");
    return;
  }
  const [existingByUsername] = await db
    .select({ id: employeeAccounts.id })
    .from(employeeAccounts)
    .where(eq(employeeAccounts.username, username))
    .limit(1);
  if (existingByUsername) return;

  let [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.code, "EMP-ADMIN-001"))
    .limit(1);

  if (employee) {
    const [existingByEmployee] = await db
      .select({ id: employeeAccounts.id })
      .from(employeeAccounts)
      .where(eq(employeeAccounts.employeeId, employee.id))
      .limit(1);
    if (existingByEmployee) return;
  }

  if (!employee) {
    [employee] = await db
      .insert(employees)
      .values({
        code: "EMP-ADMIN-001",
        name: "مدیر سیستم",
        mobile: "09999999999",
        cooperationType: "employee",
        role: "admin",
        status: "active",
        offboardingStage: "active",
      })
      .returning();
  }

  const [role] = await db.select().from(roles).where(eq(roles.code, "admin")).limit(1);
  if (!role) throw new Error("نقش مدیر سیستم در دیتابیس وجود ندارد.");

  await db
    .insert(employeeAccounts)
    .values({
      employeeId: employee.id,
      username,
      passwordHash: hashPassword(password),
      roleId: role.id,
      status: "active",
    })
    .onConflictDoNothing();
}
