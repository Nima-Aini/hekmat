import {
  pgTable,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  uuid,
  primaryKey,
  uniqueIndex,
  index
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// 1. Projects Dimension
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  label: text("label"),
  description: text("description"),
  icon: text("icon").default("folder"),
  color: text("color").default("#3b82f6"),
  status: text("status").default("active").notNull(), // active, paused, archived, completed
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  pricingSettings: jsonb("pricing_settings").default({ defaultMarginPercent: 25 }),
  commissionSettings: jsonb("commission_settings").default({ defaultRatePercent: 5 }),
  accountingSettings: jsonb("accounting_settings").default({ taxEnabled: false, defaultTaxRate: 10 }),
  managerEmployeeId: uuid("manager_employee_id"),
  logoUrl: text("logo_url"),
  targetMonthlySales: numeric("target_monthly_sales", { precision: 15, scale: 2 }).default("0"),
  targetYearlySales: numeric("target_yearly_sales", { precision: 15, scale: 2 }).default("0"),
  targetCustomerCount: integer("target_customer_count").default(0),
  targetProfit: numeric("target_profit", { precision: 15, scale: 2 }).default("0"),
  targetCollection: numeric("target_collection", { precision: 15, scale: 2 }).default("0"),
  independentSalesAllowed: boolean("independent_sales_allowed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Customers CRM
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  storeName: text("store_name"),
  mobile: text("mobile").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city").default("تهران"),
  region: text("region"),
  postalCode: text("postal_code"),
  latitude: numeric("latitude", { precision: 10, scale: 6 }),
  longitude: numeric("longitude", { precision: 10, scale: 6 }),
  paymentTermsDays: integer("payment_terms_days").default(30),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }).default("0"),
  assignedEmployeeId: uuid("assigned_employee_id"),
  status: text("status").default("active").notNull(), // active, inactive, churned
  healthScore: integer("health_score").default(85).notNull(), // 0..100
  healthStatus: text("health_status").default("green").notNull(), // green, yellow, red
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customerProjectMemberships = pgTable("customer_project_memberships", {
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.customerId, t.projectId] })
]);

export const customerHealthLogs = pgTable("customer_health_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  previousScore: integer("previous_score").notNull(),
  newScore: integer("new_score").notNull(),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  breakdown: jsonb("breakdown").notNull(), // recency, frequency, monetary, overdue, returns
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Employees / Visitors
export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  mobile: text("mobile").notNull(),
  phone: text("phone"),
  nationalId: text("national_id"),
  avatarUrl: text("avatar_url"),
  birthDate: timestamp("birth_date"),
  address: text("address"),
  description: text("description"),
  cooperationType: text("cooperation_type").default("visitor").notNull(),
  role: text("role").default("visitor").notNull(),
  status: text("status").default("active").notNull(),
  offboardingStage: text("offboarding_stage").default("active").notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  activityScope: text("activity_scope"),
  managerId: uuid("manager_id"),
  baseSalary: numeric("base_salary", { precision: 15, scale: 2 }).default("0"),
  commissionRatePercent: numeric("commission_rate_percent", { precision: 5, scale: 2 }).default("5"),
  commissionBase: text("commission_base").default("sales_total").notNull(), // sales_total, net_profit
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const employeeProjectMemberships = pgTable("employee_project_memberships", {
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.employeeId, t.projectId] })
]);

export const customerAssignments = pgTable("customer_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").references(() => employees.id),
  projectId: uuid("project_id").references(() => projects.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  assignedBy: text("assigned_by").default("system"),
  assignmentReason: text("assignment_reason"),
  status: text("status").default("active").notNull(),
  endedAt: timestamp("ended_at"),
});

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  projectScoped: boolean("project_scoped").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })]);

export const employeeAccounts = pgTable("employee_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().unique().references(() => employees.id, { onDelete: "cascade" }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  roleId: uuid("role_id").references(() => roles.id),
  status: text("status").default("active").notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const employeeProjectAssignments = pgTable("employee_project_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  status: text("status").default("active").notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
  projectSalary: numeric("project_salary", { precision: 15, scale: 2 }).default("0"),
  permissionSet: jsonb("permission_set").default({}),
}, (t) => [uniqueIndex("uniq_employee_project_assignment").on(t.employeeId, t.projectId)]);

export const projectCompensations = pgTable("project_compensations", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  effectiveStartDate: timestamp("effective_start_date").defaultNow().notNull(),
  effectiveEndDate: timestamp("effective_end_date"),
  status: text("status").default("active").notNull(),
  notes: text("notes"),
});

export const projectTargets = pgTable("project_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  salesTarget: numeric("sales_target", { precision: 15, scale: 2 }).default("0"),
  customerTarget: integer("customer_target").default(0),
  profitTarget: numeric("profit_target", { precision: 15, scale: 2 }).default("0"),
  collectionTarget: numeric("collection_target", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. Suppliers
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  mobile: text("mobile").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city").default("تهران"),
  notes: text("notes"),
  payableBalance: numeric("payable_balance", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 5. Raw Materials Module
export const rawMaterials = pgTable("raw_materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  unit: text("unit").default("کیلوگرم").notNull(), // kg, liter, piece, pack, carton
  unitConversionFactor: numeric("unit_conversion_factor", { precision: 10, scale: 4 }).default("1.0000"), // e.g., 1 carton = 18 pieces
  secondaryUnit: text("secondary_unit"),
  stockQuantity: numeric("stock_quantity", { precision: 15, scale: 4 }).default("0").notNull(),
  minStockQuantity: numeric("min_stock_quantity", { precision: 15, scale: 4 }).default("10").notNull(),
  currentCost: numeric("current_cost", { precision: 15, scale: 2 }).default("0").notNull(), // latest cost per unit
  averageCost: numeric("average_cost", { precision: 15, scale: 2 }).default("0").notNull(), // weighted avg cost
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  costPolicy: text("cost_policy").default("average").notNull(), // average, fifo, latest
  status: text("status").default("active").notNull(), // active, inactive, archived
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rawMaterialPriceHistory = pgTable("raw_material_price_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  rawMaterialId: uuid("raw_material_id").notNull().references(() => rawMaterials.id, { onDelete: "cascade" }),
  oldCost: numeric("old_cost", { precision: 15, scale: 2 }).notNull(),
  newCost: numeric("new_cost", { precision: 15, scale: 2 }).notNull(),
  changePercent: numeric("change_percent", { precision: 7, scale: 2 }).notNull(),
  reason: text("reason").default("manual_edit"), // manual_edit, purchase, inflation_adjustment
  sourceReference: text("source_reference"), // e.g. purchase invoice #
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Products & Recipes
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").default("عمومی").notNull(),
  unit: text("unit").default("عدد").notNull(),
  packQuantity: integer("pack_quantity").default(1),
  imageUrl: text("image_url"),
  description: text("description"),
  basePrice: numeric("base_price", { precision: 15, scale: 2 }).default("0").notNull(),
  calculatedCost: numeric("calculated_cost", { precision: 15, scale: 2 }).default("0").notNull(), // calculated from BOM
  stockQuantity: numeric("stock_quantity", { precision: 15, scale: 4 }).default("0").notNull(),
  minStockQuantity: numeric("min_stock_quantity", { precision: 15, scale: 4 }).default("5").notNull(),
  targetStockQuantity: numeric("target_stock_quantity", { precision: 15, scale: 4 }).default("50"),
  commissionRatePercent: numeric("commission_rate_percent", { precision: 5, scale: 2 }).default("5"),
  status: text("status").default("active").notNull(), // active, inactive, archived
  isSpecial: boolean("is_special").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Special Products Module (محصولات اختصاصی)
export const specialProducts = pgTable("special_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // e.g. SPC-0001
  name: text("name").notNull(),
  category: text("category").default("اختصاصی").notNull(),
  unit: text("unit").default("عدد").notNull(), // عدد, لیتر, کیلوگرم, متر, بسته, ...
  imageUrl: text("image_url"),
  description: text("description"),
  basePrice: numeric("base_price", { precision: 15, scale: 2 }).default("0"),
  stockQuantity: numeric("stock_quantity", { precision: 15, scale: 4 }).default("0"),
  minStockQuantity: numeric("min_stock_quantity", { precision: 15, scale: 4 }).default("0"),
  status: text("status").default("active").notNull(), // active, inactive
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Code Sequences for Monotonic Unique Identifiers (PRD-0001, SPC-0001)
export const codeSequences = pgTable("code_sequences", {
  id: text("id").primaryKey(), // 'product', 'special_product'
  lastValue: integer("last_value").default(0).notNull(),
  prefix: text("prefix").notNull(), // 'PRD-', 'SPC-'
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productRecipes = pgTable("product_recipes", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  rawMaterialId: uuid("raw_material_id").notNull().references(() => rawMaterials.id, { onDelete: "cascade" }),
  quantityRequired: numeric("quantity_required", { precision: 15, scale: 4 }).notNull(), // amount of raw material needed per unit product
  wastagePercent: numeric("wastage_percent", { precision: 5, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectProductPrices = pgTable("project_product_prices", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  customPrice: numeric("custom_price", { precision: 15, scale: 2 }).notNull(),
  effectiveStartDate: timestamp("effective_start_date").defaultNow(),
  effectiveEndDate: timestamp("effective_end_date"),
  overrideCommissionRate: numeric("override_commission_rate", { precision: 5, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  // Prompt REQUIREMENT: Unique constraint strictly on (projectId + productId)
  uniqueIndex("uniq_project_product_price").on(t.projectId, t.productId)
]);

// 7. Warehouses & Multi-Warehouse Inventory Ledger
export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").default("central").notNull(), // central, raw_materials, finished_goods, vehicle, project, consignment
  projectId: uuid("project_id").references(() => projects.id),
  address: text("address"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inventoryLedger = pgTable("inventory_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
  itemType: text("item_type").notNull(), // product, raw_material
  itemId: uuid("item_id").notNull(), // reference product.id or rawMaterial.id
  transactionType: text("transaction_type").notNull(), // purchase, sale, sales_return, production_input, production_output, adjustment, transfer, damage, consignment_out, consignment_return
  quantityChange: numeric("quantity_change", { precision: 15, scale: 4 }).notNull(), // positive for IN, negative for OUT
  quantityBefore: numeric("quantity_before", { precision: 15, scale: 4 }).notNull(),
  quantityAfter: numeric("quantity_after", { precision: 15, scale: 4 }).notNull(),
  unitCostSnapshot: numeric("unit_cost_snapshot", { precision: 15, scale: 2 }).default("0"),
  totalCostSnapshot: numeric("total_cost_snapshot", { precision: 15, scale: 2 }).default("0"),
  referenceType: text("reference_type"), // invoice, purchase, production_batch, consignment, manual_adjustment
  referenceId: uuid("reference_id"),
  projectId: uuid("project_id").references(() => projects.id),
  notes: text("notes"),
  createdById: uuid("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 8. Purchases & Supplier Items
export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseNumber: text("purchase_number").notNull().unique(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  projectId: uuid("project_id").references(() => projects.id),
  purchaseDate: timestamp("purchase_date").defaultNow().notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0").notNull(),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  tax: numeric("tax", { precision: 15, scale: 2 }).default("0"),
  grandTotal: numeric("grand_total", { precision: 15, scale: 2 }).default("0").notNull(),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  status: text("status").default("completed").notNull(), // draft, completed, cancelled
  paymentStatus: text("payment_status").default("unpaid").notNull(), // unpaid, partial, paid
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const purchaseItems = pgTable("purchase_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseId: uuid("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
  itemType: text("item_type").default("raw_material").notNull(), // raw_material, product
  itemId: uuid("item_id").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
  unit: text("unit").notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
  totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 9. Production Batches
export const productionBatches = pgTable("production_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchNumber: text("batch_number").notNull().unique(),
  productId: uuid("product_id").notNull().references(() => products.id),
  projectId: uuid("project_id").references(() => projects.id),
  quantityProduced: numeric("quantity_produced", { precision: 15, scale: 4 }).notNull(),
  totalMaterialCost: numeric("total_material_cost", { precision: 15, scale: 2 }).default("0").notNull(),
  laborCost: numeric("labor_cost", { precision: 15, scale: 2 }).default("0"),
  overheadCost: numeric("overhead_cost", { precision: 15, scale: 2 }).default("0"),
  packagingCost: numeric("packaging_cost", { precision: 15, scale: 2 }).default("0"),
  totalBatchCost: numeric("total_batch_cost", { precision: 15, scale: 2 }).default("0").notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).default("0").notNull(),
  productionDate: timestamp("production_date").defaultNow().notNull(),
  status: text("status").default("completed").notNull(), // planned, in_progress, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productionBatchItems = pgTable("production_batch_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id").notNull().references(() => productionBatches.id, { onDelete: "cascade" }),
  rawMaterialId: uuid("raw_material_id").notNull().references(() => rawMaterials.id),
  quantityConsumed: numeric("quantity_consumed", { precision: 15, scale: 4 }).notNull(),
  unitCostSnapshot: numeric("unit_cost_snapshot", { precision: 15, scale: 2 }).notNull(),
  totalCostSnapshot: numeric("total_cost_snapshot", { precision: 15, scale: 2 }).notNull(),
  wasteQuantity: numeric("waste_quantity", { precision: 15, scale: 4 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 10. Invoices & Invoice Items
export const invoices = pgTable("invoices", {
  requestKey: text("request_key").unique(),
  requestHash: text("request_hash"),
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  projectId: uuid("project_id").references(() => projects.id),
  salesMode: text("sales_mode").default("direct").notNull(), // direct, visitor, visitor_intermediary, intermediary
  employeeId: uuid("employee_id").references(() => employees.id), // Salesperson / Visitor
  intermediaryEmployeeId: uuid("intermediary_employee_id").references(() => employees.id), // Intermediary
  invoiceDate: timestamp("invoice_date").defaultNow().notNull(),
  dueDate: timestamp("due_date"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0").notNull(),
  lineDiscountsTotal: numeric("line_discounts_total", { precision: 15, scale: 2 }).default("0"),
  invoiceDiscount: numeric("invoice_discount", { precision: 15, scale: 2 }).default("0"),
  taxTotal: numeric("tax_total", { precision: 15, scale: 2 }).default("0"),
  grandTotal: numeric("grand_total", { precision: 15, scale: 2 }).default("0").notNull(),
  cogsTotal: numeric("cogs_total", { precision: 15, scale: 2 }).default("0").notNull(),
  grossProfitTotal: numeric("gross_profit_total", { precision: 15, scale: 2 }).default("0").notNull(),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  balanceDue: numeric("balance_due", { precision: 15, scale: 2 }).default("0").notNull(),
  paymentStatus: text("payment_status").default("unpaid").notNull(), // unpaid, partial, paid, overdue
  status: text("status").default("issued").notNull(), // issued, cancelled, reversed, corrected
  reversalReason: text("reversal_reason"),
  commissionSnapshot: jsonb("commission_snapshot"),
  priceSnapshot: jsonb("price_snapshot"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  isCustom: boolean("is_custom").default(false),
  customUnit: text("custom_unit").default("عدد"),
  customNotes: text("custom_notes"),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  unitCostSnapshot: numeric("unit_cost_snapshot", { precision: 15, scale: 2 }).default("0").notNull(),
  discountAmount: numeric("discount_amount", { precision: 15, scale: 2 }).default("0"),
  lineTotal: numeric("line_total", { precision: 15, scale: 2 }).notNull(),
  lineCogs: numeric("line_cogs", { precision: 15, scale: 2 }).default("0").notNull(),
  lineProfit: numeric("line_profit", { precision: 15, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 11. Accounts & Financial Transactions & Payments
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(), // cash, bank, receivable, payable, revenue, cogs, expense, equity
  accountNumber: text("account_number"),
  bankName: text("bank_name"),
  balance: numeric("balance", { precision: 15, scale: 2 }).default("0").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  requestKey: text("request_key").unique(),
  requestHash: text("request_hash"),
  id: uuid("id").defaultRandom().primaryKey(),
  paymentNumber: text("payment_number").notNull().unique(),
  customerId: uuid("customer_id").references(() => customers.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  projectId: uuid("project_id").references(() => projects.id),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  paymentType: text("payment_type").notNull(), // customer_receipt, supplier_payment, expense_payment, commission_payout, salary_payout
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").defaultNow().notNull(),
  paymentMethod: text("payment_method").default("pos").notNull(), // cash, pos, card_transfer, cheque, bank_transfer
  referenceNumber: text("reference_number"),
  status: text("status").default("completed").notNull(), // pending, completed, bounced, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  allocatedAmount: numeric("allocated_amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 12. Commission Engine & Payroll
export const commissionRules = pgTable("commission_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  projectId: uuid("project_id").references(() => projects.id),
  productId: uuid("product_id").references(() => products.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  ruleType: text("rule_type").default("percentage").notNull(), // percentage, fixed, receipt_percentage
  rateValue: numeric("rate_value", { precision: 15, scale: 2 }).notNull(),
  commissionBase: text("commission_base").default("sales_total").notNull(), // sales_total, net_profit
  effectiveStartDate: timestamp("effective_start_date"),
  effectiveEndDate: timestamp("effective_end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const commissionLedger = pgTable("commission_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  recipientEmployeeId: uuid("recipient_employee_id").references(() => employees.id),
  commissionType: text("commission_type").default("employee").notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  projectId: uuid("project_id").references(() => projects.id),
  ruleSnapshot: jsonb("rule_snapshot").notNull(),
  baseAmount: numeric("base_amount", { precision: 15, scale: 2 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 15, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(), // calculated, pending, payable, paid, reversed
  paymentId: uuid("payment_id").references(() => payments.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payrollRecords = pgTable("payroll_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  periodName: text("period_name").notNull(), // e.g. "فروردین 1403"
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  projectId: uuid("project_id").references(() => projects.id),
  baseSalary: numeric("base_salary", { precision: 15, scale: 2 }).default("0").notNull(),
  commissionEarned: numeric("commission_earned", { precision: 15, scale: 2 }).default("0").notNull(),
  bonus: numeric("bonus", { precision: 15, scale: 2 }).default("0"),
  advances: numeric("advances", { precision: 15, scale: 2 }).default("0"),
  deductions: numeric("deductions", { precision: 15, scale: 2 }).default("0"),
  netPayable: numeric("net_payable", { precision: 15, scale: 2 }).notNull(),
  status: text("status").default("draft").notNull(), // draft, approved, paid
  paymentId: uuid("payment_id").references(() => payments.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 13. Expenses
export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  expenseNumber: text("expense_number").notNull().unique(),
  category: text("category").default("عمومی").notNull(), // rent, utilities, marketing, transport, salary, commission, raw_materials, general
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  projectId: uuid("project_id").references(() => projects.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  accountId: uuid("account_id").references(() => accounts.id),
  expenseDate: timestamp("expense_date").defaultNow().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  receiptImageUrl: text("receipt_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 14. Consignments (امانی)
export const consignments = pgTable("consignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  consignmentNumber: text("consignment_number").notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  projectId: uuid("project_id").references(() => projects.id),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  status: text("status").default("delivered").notNull(), // delivered, partially_sold, fully_sold, returned, closed
  totalConsignedValue: numeric("total_consigned_value", { precision: 15, scale: 2 }).default("0").notNull(),
  totalSoldValue: numeric("total_sold_value", { precision: 15, scale: 2 }).default("0"),
  totalCollected: numeric("total_collected", { precision: 15, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const consignmentItems = pgTable("consignment_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  consignmentId: uuid("consignment_id").notNull().references(() => consignments.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantityDelivered: numeric("quantity_delivered", { precision: 15, scale: 4 }).notNull(),
  quantitySold: numeric("quantity_sold", { precision: 15, scale: 4 }).default("0").notNull(),
  quantityReturned: numeric("quantity_returned", { precision: 15, scale: 4 }).default("0").notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 15. Alerts & Tasks & Audit Logs
export const alerts = pgTable("alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(), // low_stock, raw_material_shortage, overdue_invoice, health_red, commission_unpaid, margin_drop, backup_failed
  severity: text("severity").default("warning").notNull(), // info, warning, critical
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"), // customer, product, raw_material, invoice, project
  entityId: uuid("entity_id"),
  projectId: uuid("project_id").references(() => projects.id),
  status: text("status").default("new").notNull(), // new, in_review, resolved, auto_closed
  dedupKey: text("dedup_key").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignedEmployeeId: uuid("assigned_employee_id").references(() => employees.id),
  entityType: text("entity_type"), // customer, invoice, alert, supplier, project
  entityId: uuid("entity_id"),
  dueDate: timestamp("due_date"),
  priority: text("priority").default("medium").notNull(), // low, medium, high
  status: text("status").default("open").notNull(), // open, in_progress, done, cancelled, overdue
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(), // CREATE, UPDATE, DELETE, REVERSE, OFFBOARD, BACKUP, RESTORE
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  userId: text("user_id").default("system_user"),
  userName: text("user_name").default("کاربر سیستم"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const backups = pgTable("backups", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: text("filename").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum").notNull(),
  status: text("status").default("completed").notNull(), // completed, failed, restored
  backupData: jsonb("backup_data"), // Complete serialized system snapshot
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const systemSettings = pgTable("system_settings", {
  id: text("id").primaryKey().default("main_config"),
  businessName: text("business_name").default("سازمان و کسب‌وکار حکمت آکما"),
  taxNumber: text("tax_number"),
  economicCode: text("economic_code"),
  nationalId: text("national_id"),
  registrationNumber: text("registration_number"),
  postalCode: text("postal_code"),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  taxOffice: text("tax_office"),
  taxRateCorporate: integer("tax_rate_corporate").default(25),
  vatRate: integer("vat_rate").default(10),
  currency: text("currency").default("تومان"),
  numberFormat: text("number_format").default("fa-IR"),
  pricingRule: text("pricing_rule").default("tiered_margin"),
  healthGreenThreshold: integer("health_green_threshold").default(75),
  healthYellowThreshold: integer("health_yellow_threshold").default(50),
  mapProvider: text("map_provider").default("neshan"),
  openaiApiKey: text("openai_api_key"),
  openaiModel: text("openai_model").default("gemini-2.5-flash"),
  aiEnabled: boolean("ai_enabled").default(true),
  neshanApiKey: text("neshan_api_key"),
  autoBackupIntervalHours: integer("auto_backup_interval_hours").default(24),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations declarations
export const projectsRelations = relations(projects, ({ many }) => ({
  customerMemberships: many(customerProjectMemberships),
  employeeMemberships: many(employeeProjectMemberships),
  invoices: many(invoices),
  productionBatches: many(productionBatches),
  expenses: many(expenses),
  projectProductPrices: many(projectProductPrices),
}));

export const customersRelations = relations(customers, ({ many, one }) => ({
  projectMemberships: many(customerProjectMemberships),
  invoices: many(invoices),
  healthLogs: many(customerHealthLogs),
  consignments: many(consignments),
  assignedEmployee: one(employees, {
    fields: [customers.assignedEmployeeId],
    references: [employees.id],
  }),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  projectMemberships: many(employeeProjectMemberships),
  invoices: many(invoices),
  assignedCustomers: many(customers),
  payrollRecords: many(payrollRecords),
  commissionLedgers: many(commissionLedger),
}));

export const rawMaterialsRelations = relations(rawMaterials, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [rawMaterials.supplierId],
    references: [suppliers.id],
  }),
  priceHistory: many(rawMaterialPriceHistory),
  productRecipes: many(productRecipes),
}));

export const productsRelations = relations(products, ({ many }) => ({
  recipes: many(productRecipes),
  projectPrices: many(projectProductPrices),
  invoiceItems: many(invoiceItems),
  productionBatches: many(productionBatches),
}));

export const projectProductPricesRelations = relations(projectProductPrices, ({ one }) => ({
  project: one(projects, {
    fields: [projectProductPrices.projectId],
    references: [projects.id],
  }),
  product: one(products, {
    fields: [projectProductPrices.productId],
    references: [products.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id],
  }),
  employee: one(employees, {
    fields: [invoices.employeeId],
    references: [employees.id],
  }),
  items: many(invoiceItems),
  paymentAllocations: many(paymentAllocations),
  commissionLedgers: many(commissionLedger),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceItems.productId],
    references: [products.id],
  }),
}));
