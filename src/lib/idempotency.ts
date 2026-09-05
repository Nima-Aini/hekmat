import crypto from "node:crypto";
import { ApiError } from "./apiError";
export function requestIdentity(req: Request, actor: string, body: unknown) {
  const key = req.headers.get("Idempotency-Key");
  if (!key) return {};
  if (key.length > 200 || !key.trim()) throw new ApiError(400, "کلید درخواست معتبر نیست.");
  return {
    requestKey: crypto.createHash("sha256").update(`${actor}:${key}`).digest("hex"),
    requestHash: crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex"),
  };
}
