"use client";
// Retain the same key after a lost response; successful submissions start a new operation.
const pending = new Map<string, { payload: string; key: string }>();
export async function retryableRequest(url: string, init: RequestInit): Promise<Response> {
  const payload = typeof init.body === "string" ? init.body : "";
  let entry = pending.get(url);
  if (!entry || entry.payload !== payload) {
    entry = { payload, key: crypto.randomUUID() };
    pending.set(url, entry);
  }
  const headers = new Headers(init.headers);
  headers.set("Idempotency-Key", entry.key);
  const response = await fetch(url, { ...init, headers });
  const result = await response.clone().json().catch(() => null);
  if (response.ok && result?.success && pending.get(url) === entry) pending.delete(url);
  return response;
}
