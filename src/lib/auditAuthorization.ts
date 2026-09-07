export function canManageAuditActions(input: { roleCode?: string | null; permissions?: Iterable<string> | null }) {
  const permissions = new Set(input.permissions || []);
  return input.roleCode === "admin" || permissions.has("*");
}
