import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/apiError";

const mocks = vi.hoisted(() => ({
  requireAuditManager: vi.fn(),
  reverseInvoice: vi.fn(),
  cancelOrder: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/services/access", () => ({ requireAuditManager: mocks.requireAuditManager }));
vi.mock("@/services/invoice", () => ({ reverseInvoice: mocks.reverseInvoice }));
vi.mock("@/services/order", () => ({ cancelOrder: mocks.cancelOrder }));
vi.mock("@/db", () => ({ db: { select: mocks.select } }));

import { POST } from "../src/app/api/audit-logs/[id]/actions/route";

const logId = "11111111-1111-4111-8111-111111111111";
const entityId = "22222222-2222-4222-8222-222222222222";

function selectResult(rows: unknown[]) {
  const builder: any = {};
  builder.from = vi.fn(() => builder);
  builder.where = vi.fn(() => builder);
  builder.orderBy = vi.fn(() => builder);
  builder.limit = vi.fn(async () => rows);
  return builder;
}

describe("admin actions from audit logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reverseInvoice.mockResolvedValue({ id: entityId, status: "reversed" });
  });

  it("forbids a direct request when the server-side admin guard rejects it", async () => {
    mocks.requireAuditManager.mockRejectedValue(new ApiError(403, "فقط مدیر سیستم"));
    const response = await POST(new Request("http://localhost/api/audit-logs/x/actions", { method: "POST", body: JSON.stringify({ action: "reverse" }) }), { params: Promise.resolve({ id: logId }) });
    expect(response.status).toBe(403);
    expect(mocks.reverseInvoice).not.toHaveBeenCalled();
  });

  it("uses the real reversal service and links the new event to the immutable parent", async () => {
    mocks.requireAuditManager.mockResolvedValue({ employeeId: "admin-id", employeeName: "مدیر سیستم", permissions: new Set(["*"]), roleCode: "admin" });
    const parent = { id: logId, entityType: "invoice", entityId, action: "CREATE" };
    const child = { id: "33333333-3333-4333-8333-333333333333", entityType: "invoice", entityId, action: "REVERSE", parentLogId: logId };
    mocks.select.mockReturnValueOnce(selectResult([parent])).mockReturnValueOnce(selectResult([child]));
    const response = await POST(new Request("http://localhost/api/audit-logs/x/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reverse", reason: "اصلاح مدیریتی" }) }), { params: Promise.resolve({ id: logId }) });
    expect(response.status).toBe(200);
    expect(mocks.reverseInvoice).toHaveBeenCalledWith(entityId, "اصلاح مدیریتی", expect.objectContaining({ parentLogId: logId, source: "audit_log", userId: "admin-id" }));
    expect((await response.json()).log).toMatchObject({ action: "REVERSE", parentLogId: logId });
  });
});
