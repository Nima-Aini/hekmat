# Production Debug, Audit and Fix Report

Date: 2026-09-05

## 1. Product Delete Root Cause

`DELETE /api/products/[id]` always issued a physical `DELETE` against `products`. Products referenced by historical tables (notably `invoice_items`, `production_batches`, `commission_rules`, and `consignment_items`) were protected by foreign keys, so PostgreSQL correctly rejected only those deletions. The migration-created `invoice_items.product_id` constraint also differed from the Drizzle declaration, which made behavior dependent on the deployed schema. Polymorphic references in purchase and inventory ledgers were not foreign keys and therefore also had to be checked explicitly.

The failure was reproduced in a real PostgreSQL-compatible integration test: direct deletion of an invoiced product raises the same FK query failure.

## 2. Product Delete Fix

- Added one transactional deletion policy in `src/services/product.ts`.
- Products with invoice, production, commission, consignment, purchase, inventory, or legacy special-product history are archived.
- Products without history are physically deleted together with only disposable BOM/project-price configuration.
- Historical invoice and financial rows are never cascade-deleted.
- Archived products are excluded from active product/catalog lists and cannot be sold or produced.
- Invalid/missing IDs return 400/404; missing/insufficient permission returns 401/403.
- Internal database errors are logged server-side and replaced by safe Persian API messages.
- Product create/update/BOM replacement and inventory adjustment are transactional and validated.
- The UI shows the server result, prevents concurrent delete clicks, refreshes after success, and explains that historical products are archived.

Primary files: `src/services/product.ts`, `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`, `src/app/api/special-products/route.ts`, `src/app/api/special-products/[id]/route.ts`, `src/components/views/ProductsView.tsx`.

## 3. Database Problems Fixed

- Added safe, repeatable migration changes; no table is truncated or dropped.
- Added nullable idempotency keys and unique indexes for invoices/payments.
- Made retained legacy columns non-blocking for current ORM inserts.
- Retained old production columns for rollback compatibility instead of dropping them.
- Fixed legacy `consignment_items.quantity_out` default drift.
- Added the missing `products.delete` permission.
- Added a migration integration test that runs migrations twice and compares required database columns with Drizzle schema.
- Added row locking and transactions around product, invoice, inventory, purchase, commission payout, and payment operations touched by this audit.

## 4. Backend/API Problems Fixed

- Centralized safe API error classification and UUID/numeric validation.
- Removed raw SQL/Drizzle error leakage from audited handlers.
- Added missing authentication/authorization to product access, special products, production, raw materials, maps, analytics, and employee dashboard routes.
- Removed swallowed authorization errors in project and expense APIs.
- Moved invoice/purchase access scoping into database queries where applicable.
- Fixed cross-project and cross-employee invoice/payment/report/search access paths.
- Added Origin/Sec-Fetch-Site protection for unsafe API methods.
- Added pull-request verification workflow for tests, types, lint, and build.

## 5. Business Logic Problems Fixed

- Invoice price/name/cost snapshots remain independent of later product edits/deletion.
- Invoice/payment creation supports idempotency keys to prevent duplicate effects after client retries.
- Repeated invoice reversal is rejected and cannot restore stock twice.
- Invoice deletion now performs an audited reversal and retains financial history.
- Payment status cannot be changed independently of payment transactions.
- Negative/excess discounts, invalid prices/quantities, overpayment, sale/production of archived products, and editing reversed invoices are rejected.
- Commission recalculation occurs after invoice totals/items change; settled commission blocks unsafe edits.
- Product and raw-material stock edits now create inventory ledger entries.
- Purchase create/edit/void operations are atomic; product purchases update product stock, paid purchases cannot be silently deleted, and paid totals cannot be edited directly.
- Raw-material weighted-average cost now uses pre-purchase stock and price history participates in the same transaction.

## 6. Security Problems Fixed

- **Critical:** none confirmed.
- **High:** fixed missing API authorization and IDOR paths affecting employee/product access, invoices, payments, project reports/search, and project/expense routes.
- **High:** upgraded Next.js and PostCSS to patched compatible versions; dependency audit now reports no High/Critical issues.
- **Medium:** added CSRF-style same-origin enforcement for state-changing API requests.
- **Medium:** stopped internal database messages from reaching clients; server logging remains enabled.
- **Medium:** tightened session token parsing and login input validation.
- **Low:** employee catalog no longer returns account balances.

No secret value is included in this report.

## 7. Frontend Problems Fixed

- Product deletion now has a clear confirmation and archive explanation.
- Delete actions cannot be double-submitted while pending.
- Product loading/delete failures are surfaced instead of showing false success.
- Invoice/payment submissions use stable retry keys, preventing duplicate orders/payments after a lost response.

## 8. Migrations

Migration: `20260905 production audit hardening` (implemented idempotently in `src/db/migrate.ts`).

Impact: additive nullable columns/indexes, permission seed, defaults/nullability corrections for legacy compatibility. Existing business data is retained. No table, order, invoice, or financial history is deleted.

Production execution: automatic during application startup through `src/instrumentation.ts`. The existing deployment takes a PostgreSQL backup before updating code and starts the application; startup runs `migrateDatabase()` before the health check.

## 9. Verification

- `npm install`: passed
- `npm test`: passed — 19/19 tests
- `npm run typecheck`: passed — 0 errors
- `npm run lint`: passed — 0 errors, 27 existing warnings
- `npm run build`: passed with Next.js 16.3.4
- `npm audit --audit-level=high`: passed — 0 Critical/High; 4 Moderate dev-tool findings
- `git diff --check`: passed

Tested product scenarios include valid/invalid create, price/stock/details update, unused deletion, invoiced/referenced archive, invalid/missing ID, anonymous/unauthorized delete, safe error response, transaction rollback, migration rerun/drift checks, snapshot preservation, idempotent invoice retry, and single-effect reversal.

## 10. Remaining Issues

1. A Neshan service key is hardcoded in the repository. It must be rotated in Neshan and moved to `NESHAN_API_KEY`; removing the fallback before rotation could break production maps.
2. Exact live-production constraints/orphan rows could not be inspected because no production `DATABASE_URL` or read-only database connection was available. The integration migration/drift tests cover the repository schema, not unknown manual changes in the live database.
3. Lint has 27 non-blocking warnings, primarily pre-existing React hook dependency and image optimization warnings. They were not mass-edited because changing hook dependencies without browser regression coverage can alter runtime behavior.
4. Four Moderate `npm audit` findings are confined to `drizzle-kit` development tooling. The offered automated fix downgrades it to a breaking old version; it is not loaded by the production application.
5. Distributed login rate limiting should be enforced at Nginx/WAF or a shared datastore. A process-local limiter would be unreliable across restarts/instances.
