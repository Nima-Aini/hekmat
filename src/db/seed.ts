import { db } from "./index";
import {
  projects,
  customers,
  customerProjectMemberships,
  employees,
  employeeProjectMemberships,
  suppliers,
  rawMaterials,
  rawMaterialPriceHistory,
  products,
  productRecipes,
  projectProductPrices,
  warehouses,
  accounts,
  invoices,
  invoiceItems,
  payments,
  paymentAllocations,
  expenses,
  productionBatches,
  productionBatchItems,
  inventoryLedger,
  alerts,
  systemSettings
} from "./schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  console.log("Starting database seed...");

  // Check if system settings already seeded
  const [existingSettings] = await db.select().from(systemSettings).limit(1);
  if (existingSettings) {
    console.log("Database already seeded. Skipping initial seed.");
    return;
  }

  // 1. System Settings
  await db.insert(systemSettings).values({
    id: "main_config",
    businessName: "سازمان و سیستم عملیاتی حکمت آکما",
    taxNumber: "10103482910",
    currency: "تومان",
    numberFormat: "fa-IR",
    pricingRule: "tiered_margin",
    healthGreenThreshold: 75,
    healthYellowThreshold: 50,
    mapProvider: "neshan",
    aiEnabled: true,
  });

  // 2. Warehouses
  const [centralWh] = await db
    .insert(warehouses)
    .values({
      code: "WH-CENTRAL",
      name: "انبار مرکزی و محصولات نهایی",
      type: "finished_goods",
      isDefault: true,
    })
    .returning();

  const [rawWh] = await db
    .insert(warehouses)
    .values({
      code: "WH-RAW",
      name: "انبار مواد اولیه و قطعات",
      type: "raw_materials",
    })
    .returning();

  // 3. Accounts
  const [cashAccount] = await db
    .insert(accounts)
    .values({
      code: "ACC-101",
      name: "صندوق مرکزی ریالی",
      type: "cash",
      balance: "45000000",
      isDefault: true,
    })
    .returning();

  const [bankAccount] = await db
    .insert(accounts)
    .values({
      code: "ACC-102",
      name: "حساب بانک ملت (جام)",
      type: "bank",
      bankName: "بانک ملت",
      accountNumber: "6542109843",
      balance: "185000000",
    })
    .returning();

  // 4. Projects
  const [projectA] = await db
    .insert(projects)
    .values({
      code: "PRJ-101",
      name: "پروژه مجتمع تجاری آریا",
      label: "تجاری VIP",
      description: "تامین تجهیزات و پنجره‌های دو جداره مجتمع آریا",
      icon: "building",
      color: "#3b82f6",
      status: "active",
    })
    .returning();

  const [projectB] = await db
    .insert(projects)
    .values({
      code: "PRJ-102",
      name: "پروژه برج مسکونی آفتاب",
      label: "مسکونی",
      description: "پروژه برج ۲۴ طبقه آفتاب پاسداران",
      icon: "home",
      color: "#10b981",
      status: "active",
    })
    .returning();

  // 5. Employees / Visitors
  const [empVisitor] = await db
    .insert(employees)
    .values({
      code: "EMP-01",
      name: "علی محمدی (ویزیتور منطقه ۱)",
      mobile: "09121112233",
      role: "visitor",
      commissionRatePercent: "5.00",
      status: "active",
    })
    .returning();

  const [empManager] = await db
    .insert(employees)
    .values({
      code: "EMP-02",
      name: "رضا حسینی (مدیر فروش)",
      mobile: "09123334455",
      role: "manager",
      commissionRatePercent: "3.00",
      status: "active",
    })
    .returning();

  await db.insert(employeeProjectMemberships).values([
    { employeeId: empVisitor.id, projectId: projectA.id },
    { employeeId: empVisitor.id, projectId: projectB.id },
  ]);

  // 6. Customers
  const [cust1] = await db
    .insert(customers)
    .values({
      code: "CUST-1001",
      name: "مهندس کامران رستمی",
      storeName: "صنایع ساختمانی رستمی",
      mobile: "09129876543",
      address: "تهران، خیابان شریعتی، بالاتر از میرداماد، پلاک ۱۲",
      city: "تهران",
      latitude: "35.7580",
      longitude: "51.4420",
      assignedEmployeeId: empVisitor.id,
      healthScore: 88,
      healthStatus: "green",
    })
    .returning();

  const [cust2] = await db
    .insert(customers)
    .values({
      code: "CUST-1002",
      name: "فروشگاه و ابزار ساختمانی البرز",
      storeName: "ابزار البرز",
      mobile: "09128887766",
      address: "تهران، میدان ونک، خیابان ملاصدرا",
      city: "تهران",
      latitude: "35.7530",
      longitude: "51.3910",
      assignedEmployeeId: empVisitor.id,
      healthScore: 62,
      healthStatus: "yellow",
    })
    .returning();

  const [cust3] = await db
    .insert(customers)
    .values({
      code: "CUST-1003",
      name: "بازرگانی اصفهان سازه",
      storeName: "اصفهان سازه",
      mobile: "09131114455",
      address: "اصفهان، خیابان چهرباغ عباسی",
      city: "اصفهان",
      latitude: "32.6546",
      longitude: "51.6680",
      healthScore: 42,
      healthStatus: "red",
    })
    .returning();

  await db.insert(customerProjectMemberships).values([
    { customerId: cust1.id, projectId: projectA.id },
    { customerId: cust2.id, projectId: projectB.id },
  ]);

  // 7. Suppliers
  const [supplier1] = await db
    .insert(suppliers)
    .values({
      code: "SUP-01",
      name: "صنایع آلومینیوم و فلزات ایران",
      contactPerson: "آقای احمدی",
      mobile: "09125556677",
      address: "اراک، شهرک صنعتی ۲",
    })
    .returning();

  // 8. Raw Materials
  const [rm1] = await db
    .insert(rawMaterials)
    .values({
      code: "RM-101",
      name: "پروفیل آلومینیوم خام",
      unit: "کیلوگرم",
      stockQuantity: "850.00",
      minStockQuantity: "200.00",
      currentCost: "185000", // 185,000 Toman per kg
      averageCost: "180000",
      supplierId: supplier1.id,
    })
    .returning();

  const [rm2] = await db
    .insert(rawMaterials)
    .values({
      code: "RM-102",
      name: "شیشه سکوریت ۶ میلی‌متری",
      unit: "مترمربع",
      stockQuantity: "120.00",
      minStockQuantity: "50.00",
      currentCost: "420000",
      averageCost: "400000",
      supplierId: supplier1.id,
    })
    .returning();

  const [rm3] = await db
    .insert(rawMaterials)
    .values({
      code: "RM-103",
      name: "یراق‌آلات و لولا فلزی",
      unit: "بسته",
      unitConversionFactor: "10", // 1 pack = 10 pieces
      secondaryUnit: "عدد",
      stockQuantity: "15.00", // Low stock!
      minStockQuantity: "30.00",
      currentCost: "95000",
      averageCost: "90000",
      supplierId: supplier1.id,
    })
    .returning();

  // 9. Products & BOM Recipes
  const [prod1] = await db
    .insert(products)
    .values({
      code: "PRD-201",
      name: "پنجره دوجداره آلومینیومی الیت",
      category: "پنجره",
      unit: "عدد",
      basePrice: "2800000", // 2,800,000 Toman
      calculatedCost: "1850000",
      stockQuantity: "45.00",
      minStockQuantity: "10.00",
    })
    .returning();

  const [prod2] = await db
    .insert(products)
    .values({
      code: "PRD-202",
      name: "درب کشویی اختصاصی فریم‌لس",
      category: "درب",
      unit: "عدد",
      basePrice: "4500000",
      calculatedCost: "3100000",
      stockQuantity: "8.00",
      minStockQuantity: "15.00", // Low stock!
    })
    .returning();

  // Product BOM Recipes
  await db.insert(productRecipes).values([
    {
      productId: prod1.id,
      rawMaterialId: rm1.id,
      quantityRequired: "5.5", // 5.5 kg aluminum per window
      wastagePercent: "5.0",
    },
    {
      productId: prod1.id,
      rawMaterialId: rm2.id,
      quantityRequired: "1.8", // 1.8 sqm glass
      wastagePercent: "2.0",
    },
  ]);

  // Project Specific Prices (PROMPT REQUIREMENT B Test setup: unique on projectId + productId)
  await db.insert(projectProductPrices).values([
    {
      projectId: projectA.id,
      productId: prod1.id,
      customPrice: "2650000", // Special discounted price for Project A
    },
    {
      projectId: projectB.id,
      productId: prod1.id,
      customPrice: "2950000", // Higher customized price for Project B
    },
  ]);

  // 10. Sample Invoices & Items
  const [inv1] = await db
    .insert(invoices)
    .values({
      invoiceNumber: "INV-140301-1001",
      customerId: cust1.id,
      projectId: projectA.id,
      employeeId: empVisitor.id,
      salesMode: "visitor",
      invoiceDate: new Date(Date.now() - 5 * 86400000),
      dueDate: new Date(Date.now() + 25 * 86400000),
      subtotal: "26500000",
      lineDiscountsTotal: "500000",
      invoiceDiscount: "0",
      taxTotal: "0",
      grandTotal: "26000000",
      cogsTotal: "18500000",
      grossProfitTotal: "7500000",
      paidAmount: "15000000",
      balanceDue: "11000000",
      paymentStatus: "partial",
      status: "issued",
      notes: "فاکتور تحویل پروژه مجتمع آریا - بخش اول",
    })
    .returning();

  await db.insert(invoiceItems).values({
    invoiceId: inv1.id,
    productId: prod1.id,
    productNameSnapshot: prod1.name,
    quantity: "10.00",
    unitPrice: "2650000",
    unitCostSnapshot: "1850000",
    discountAmount: "500000",
    lineTotal: "26000000",
    lineCogs: "18500000",
    lineProfit: "7500000",
  });

  // Sample Payment
  const [pay1] = await db
    .insert(payments)
    .values({
      paymentNumber: "PAY-9001",
      customerId: cust1.id,
      invoiceId: inv1.id,
      projectId: projectA.id,
      accountId: bankAccount.id,
      paymentType: "customer_receipt",
      amount: "15000000",
      paymentMethod: "pos",
      referenceNumber: "POS-998822",
      status: "completed",
    })
    .returning();

  await db.insert(paymentAllocations).values({
    paymentId: pay1.id,
    invoiceId: inv1.id,
    allocatedAmount: "15000000",
  });

  // 11. Sample Expenses
  await db.insert(expenses).values([
    {
      expenseNumber: "EXP-101",
      category: "rent",
      amount: "12000000",
      projectId: projectA.id,
      accountId: bankAccount.id,
      title: "اجاره دفتر پروژه آریا",
    },
    {
      expenseNumber: "EXP-102",
      category: "transport",
      amount: "3500000",
      projectId: projectB.id,
      accountId: cashAccount.id,
      title: "هزینه حمل و تخلیه انبار مرکزی",
    },
  ]);

  // 12. Alerts
  await db.insert(alerts).values([
    {
      type: "raw_material_shortage",
      severity: "critical",
      title: `کمبود ماده اولیه: ${rm3.name}`,
      message: `موجودی ماده اولیه "${rm3.name}" برابر 15 بسته است که کمتر از حد مجاز (30 بسته) می‌باشد.`,
      entityType: "raw_material",
      entityId: rm3.id,
      dedupKey: `low_rm_${rm3.id}`,
    },
    {
      type: "low_stock",
      severity: "warning",
      title: `کمبود محصول: ${prod2.name}`,
      message: `موجودی محصول "${prod2.name}" کمتر از حداقل حد مجاز انبار است.`,
      entityType: "product",
      entityId: prod2.id,
      dedupKey: `low_prod_${prod2.id}`,
    },
  ]);

  console.log("Database seeded successfully!");
}
