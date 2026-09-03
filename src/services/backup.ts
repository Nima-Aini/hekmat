import { db, pool } from "@/db";
import {
  backups,
  systemSettings,
  projects,
  customers,
  customerProjectMemberships,
  customerHealthLogs,
  customerAssignments,
  employees,
  employeeProjectMemberships,
  roles,
  permissions,
  rolePermissions,
  employeeAccounts,
  employeeProjectAssignments,
  projectCompensations,
  projectTargets,
  payrollRecords,
  commissionRules,
  commissionLedger,
  suppliers,
  rawMaterials,
  rawMaterialPriceHistory,
  products,
  productRecipes,
  projectProductPrices,
  warehouses,
  inventoryLedger,
  purchases,
  purchaseItems,
  productionBatches,
  productionBatchItems,
  invoices,
  invoiceItems,
  accounts,
  payments,
  paymentAllocations,
  expenses,
  consignments,
  consignmentItems,
  alerts,
  tasks,
  auditLogs,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import crypto from "crypto";
import { toJalaliDate } from "@/lib/dateUtils";
import { logAuditEvent } from "@/services/audit";

export interface BackupPayload {
  version: string;
  system: string;
  createdAt: string;
  jalaliDate: string;
  tables: {
    systemSettings?: any[];
    projects?: any[];
    customers?: any[];
    customerProjectMemberships?: any[];
    customerHealthLogs?: any[];
    customerAssignments?: any[];
    employees?: any[];
    employeeProjectMemberships?: any[];
    roles?: any[];
    permissions?: any[];
    rolePermissions?: any[];
    employeeAccounts?: any[];
    employeeProjectAssignments?: any[];
    projectCompensations?: any[];
    projectTargets?: any[];
    payrollRecords?: any[];
    commissionRules?: any[];
    commissionLedger?: any[];
    suppliers?: any[];
    rawMaterials?: any[];
    rawMaterialPriceHistory?: any[];
    products?: any[];
    productRecipes?: any[];
    projectProductPrices?: any[];
    warehouses?: any[];
    inventoryLedger?: any[];
    purchases?: any[];
    purchaseItems?: any[];
    productionBatches?: any[];
    productionBatchItems?: any[];
    invoices?: any[];
    invoiceItems?: any[];
    accounts?: any[];
    payments?: any[];
    paymentAllocations?: any[];
    expenses?: any[];
    consignments?: any[];
    consignmentItems?: any[];
    alerts?: any[];
    tasks?: any[];
  };
}

export async function createSystemBackup(userId = "system_user", userName = "مدیر سیستم") {
  const safeSelect = async (table: any) => {
    try {
      return await db.select().from(table);
    } catch (err: any) {
      console.warn("safeSelect warning for table:", err?.message || err);
      return [];
    }
  };

  const [
    sysSettingsList,
    projectsList,
    customersList,
    custProjList,
    custHealthList,
    custAssignList,
    employeesList,
    empProjList,
    rolesList,
    permList,
    rolePermList,
    empAccList,
    empProjAssignList,
    projCompList,
    projTgtList,
    payrollList,
    commRulesList,
    commLedgerList,
    suppliersList,
    rmList,
    rmPriceList,
    productsList,
    recipesList,
    projPricesList,
    warehousesList,
    invLedgerList,
    purchasesList,
    purchaseItemsList,
    batchesList,
    batchItemsList,
    invoicesList,
    invoiceItemsList,
    accountsList,
    paymentsList,
    allocationsList,
    expensesList,
    consignmentsList,
    consignmentItemsList,
    alertsList,
    tasksList,
  ] = await Promise.all([
    safeSelect(systemSettings),
    safeSelect(projects),
    safeSelect(customers),
    safeSelect(customerProjectMemberships),
    safeSelect(customerHealthLogs),
    safeSelect(customerAssignments),
    safeSelect(employees),
    safeSelect(employeeProjectMemberships),
    safeSelect(roles),
    safeSelect(permissions),
    safeSelect(rolePermissions),
    safeSelect(employeeAccounts),
    safeSelect(employeeProjectAssignments),
    safeSelect(projectCompensations),
    safeSelect(projectTargets),
    safeSelect(payrollRecords),
    safeSelect(commissionRules),
    safeSelect(commissionLedger),
    safeSelect(suppliers),
    safeSelect(rawMaterials),
    safeSelect(rawMaterialPriceHistory),
    safeSelect(products),
    safeSelect(productRecipes),
    safeSelect(projectProductPrices),
    safeSelect(warehouses),
    safeSelect(inventoryLedger),
    safeSelect(purchases),
    safeSelect(purchaseItems),
    safeSelect(productionBatches),
    safeSelect(productionBatchItems),
    safeSelect(invoices),
    safeSelect(invoiceItems),
    safeSelect(accounts),
    safeSelect(payments),
    safeSelect(paymentAllocations),
    safeSelect(expenses),
    safeSelect(consignments),
    safeSelect(consignmentItems),
    safeSelect(alerts),
    safeSelect(tasks),
  ]);

  const now = new Date();
  const payload: BackupPayload = {
    version: "2.0",
    system: "Hekmat Akma ERP",
    createdAt: now.toISOString(),
    jalaliDate: toJalaliDate(now, { showTime: true }),
    tables: {
      systemSettings: sysSettingsList,
      projects: projectsList,
      customers: customersList,
      customerProjectMemberships: custProjList,
      customerHealthLogs: custHealthList,
      customerAssignments: custAssignList,
      employees: employeesList,
      employeeProjectMemberships: empProjList,
      roles: rolesList,
      permissions: permList,
      rolePermissions: rolePermList,
      employeeAccounts: empAccList,
      employeeProjectAssignments: empProjAssignList,
      projectCompensations: projCompList,
      projectTargets: projTgtList,
      payrollRecords: payrollList,
      commissionRules: commRulesList,
      commissionLedger: commLedgerList,
      suppliers: suppliersList,
      rawMaterials: rmList,
      rawMaterialPriceHistory: rmPriceList,
      products: productsList,
      productRecipes: recipesList,
      projectProductPrices: projPricesList,
      warehouses: warehousesList,
      inventoryLedger: invLedgerList,
      purchases: purchasesList,
      purchaseItems: purchaseItemsList,
      productionBatches: batchesList,
      productionBatchItems: batchItemsList,
      invoices: invoicesList,
      invoiceItems: invoiceItemsList,
      accounts: accountsList,
      payments: paymentsList,
      paymentAllocations: allocationsList,
      expenses: expensesList,
      consignments: consignmentsList,
      consignmentItems: consignmentItemsList,
      alerts: alertsList,
      tasks: tasksList,
    },
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const sizeBytes = Buffer.byteLength(jsonString, "utf8");
  const checksum = crypto.createHash("sha256").update(jsonString).digest("hex");

  const timestampStr = now.toISOString().replace(/[:.]/g, "-");
  const filename = `akma_backup_${timestampStr}.json`;

  const [newBackup] = await db
    .insert(backups)
    .values({
      filename,
      sizeBytes,
      checksum,
      status: "completed",
      backupData: payload as any,
    })
    .returning();

  await logAuditEvent(
    "BACKUP",
    "database",
    newBackup.id,
    {
      filename,
      sizeBytes,
      checksum,
    },
    { userId, userName }
  );

  return {
    ...newBackup,
    backupData: undefined, // keep response light
  };
}

export async function getBackupsList() {
  try {
    return await db
      .select({
        id: backups.id,
        filename: backups.filename,
        sizeBytes: backups.sizeBytes,
        checksum: backups.checksum,
        status: backups.status,
        createdAt: backups.createdAt,
      })
      .from(backups)
      .orderBy(desc(backups.createdAt));
  } catch (err: any) {
    console.warn("getBackupsList failed:", err?.message || err);
    return [];
  }
}

export async function getBackupById(id: string) {
  try {
    const [backup] = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
    return backup || null;
  } catch (err: any) {
    console.warn("getBackupById failed:", err?.message || err);
    return null;
  }
}

export async function restoreBackupPayload(payload: any, userId = "system_user", userName = "مدیر سیستم") {
  if (!payload || typeof payload !== "object" || !payload.tables) {
    throw new Error("ساختار فایل پشتیبان نامعتبر است (بخش tables یافت نشد).");
  }

  const tables = payload.tables;
  const stats: Record<string, number> = {};

  // Execute restore within single client connection transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear existing operational data in reverse dependency order
    const tableNamesInClearOrder = [
      "production_batch_items",
      "production_batches",
      "consignment_items",
      "consignments",
      "payment_allocations",
      "payments",
      "invoice_items",
      "invoices",
      "inventory_ledger",
      "purchase_items",
      "purchases",
      "product_recipes",
      "project_product_prices",
      "raw_material_price_history",
      "products",
      "raw_materials",
      "suppliers",
      "warehouses",
      "expenses",
      "accounts",
      "customer_health_logs",
      "customer_assignments",
      "customer_project_memberships",
      "customers",
      "payroll_records",
      "commission_ledger",
      "commission_rules",
      "project_targets",
      "project_compensations",
      "employee_project_assignments",
      "employee_accounts",
      "role_permissions",
      "permissions",
      "roles",
      "employee_project_memberships",
      "tasks",
      "alerts",
      "employees",
      "projects",
      "system_settings",
    ];

    for (const tbl of tableNamesInClearOrder) {
      await client.query(`TRUNCATE TABLE "${tbl}" CASCADE`);
    }

    // Helper to robustly insert raw records with accurate column mapping and data casting
    const insertTable = async (tableName: string, rows?: any[]) => {
      if (!rows || !Array.isArray(rows) || rows.length === 0) return 0;
      let count = 0;
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const keys = Object.keys(row);
        if (keys.length === 0) continue;

        // Clean column mapping: Handles both camelCase and existing snake_case
        const cols = keys.map((k) => {
          const snake = k.includes("_")
            ? k.toLowerCase()
            : k.replace(/([A-Z])/g, "_$1").toLowerCase();
          return `"${snake}"`;
        }).join(", ");

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const values = keys.map((k) => {
          const v = row[k];
          if (v === undefined) return null;
          if (v !== null && typeof v === "object" && !(v instanceof Date)) {
            return JSON.stringify(v);
          }
          return v;
        });

        const query = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        try {
          await client.query(query, values);
          count++;
        } catch (insertErr: any) {
          console.warn(`Warning inserting into ${tableName}:`, insertErr?.message || insertErr);
        }
      }
      return count;
    };

    stats.system_settings = await insertTable("system_settings", tables.systemSettings);
    stats.projects = await insertTable("projects", tables.projects);
    stats.roles = await insertTable("roles", tables.roles);
    stats.permissions = await insertTable("permissions", tables.permissions);
    stats.role_permissions = await insertTable("role_permissions", tables.rolePermissions);
    stats.employees = await insertTable("employees", tables.employees);
    stats.employee_accounts = await insertTable("employee_accounts", tables.employeeAccounts);
    stats.employee_project_memberships = await insertTable("employee_project_memberships", tables.employeeProjectMemberships);
    stats.employee_project_assignments = await insertTable("employee_project_assignments", tables.employeeProjectAssignments);
    stats.project_compensations = await insertTable("project_compensations", tables.projectCompensations);
    stats.project_targets = await insertTable("project_targets", tables.projectTargets);
    stats.customers = await insertTable("customers", tables.customers);
    stats.customer_project_memberships = await insertTable("customer_project_memberships", tables.customerProjectMemberships);
    stats.customer_assignments = await insertTable("customer_assignments", tables.customerAssignments);
    stats.customer_health_logs = await insertTable("customer_health_logs", tables.customerHealthLogs);
    stats.accounts = await insertTable("accounts", tables.accounts);
    stats.suppliers = await insertTable("suppliers", tables.suppliers);
    stats.warehouses = await insertTable("warehouses", tables.warehouses);
    stats.raw_materials = await insertTable("raw_materials", tables.rawMaterials);
    stats.raw_material_price_history = await insertTable("raw_material_price_history", tables.rawMaterialPriceHistory);
    stats.products = await insertTable("products", tables.products);
    stats.product_recipes = await insertTable("product_recipes", tables.productRecipes);
    stats.project_product_prices = await insertTable("project_product_prices", tables.projectProductPrices);
    stats.purchases = await insertTable("purchases", tables.purchases);
    stats.purchase_items = await insertTable("purchase_items", tables.purchaseItems);
    stats.invoices = await insertTable("invoices", tables.invoices);
    stats.invoice_items = await insertTable("invoice_items", tables.invoiceItems);
    stats.payments = await insertTable("payments", tables.payments);
    stats.payment_allocations = await insertTable("payment_allocations", tables.paymentAllocations);
    stats.expenses = await insertTable("expenses", tables.expenses);
    stats.production_batches = await insertTable("production_batches", tables.productionBatches);
    stats.production_batch_items = await insertTable("production_batch_items", tables.productionBatchItems);
    stats.inventory_ledger = await insertTable("inventory_ledger", tables.inventoryLedger);
    stats.consignments = await insertTable("consignments", tables.consignments);
    stats.consignment_items = await insertTable("consignment_items", tables.consignmentItems);
    stats.commission_rules = await insertTable("commission_rules", tables.commissionRules);
    stats.payroll_records = await insertTable("payroll_records", tables.payrollRecords);
    stats.commission_ledger = await insertTable("commission_ledger", tables.commissionLedger);
    stats.alerts = await insertTable("alerts", tables.alerts);
    stats.tasks = await insertTable("tasks", tables.tasks);

    await client.query("COMMIT");

    await logAuditEvent(
      "RESTORE",
      "database",
      null,
      {
        tablesRestored: stats,
        originalCreatedAt: payload.createdAt,
      },
      { userId, userName }
    );

    return stats;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

