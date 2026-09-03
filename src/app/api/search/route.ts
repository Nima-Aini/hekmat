import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, invoices, products, rawMaterials, suppliers, projects, employees, accounts } from "@/db/schema";
import { ilike, or } from "drizzle-orm";
import { requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    await requirePermission("global_search");

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const searchTerm = `%${q}%`;

    const [
      matchedCustomers,
      matchedInvoices,
      matchedProducts,
      matchedRawMaterials,
      matchedSuppliers,
      matchedProjects,
      matchedEmployees,
      matchedAccounts,
    ] = await Promise.all([
      db
        .select({
          id: customers.id,
          title: customers.name,
          code: customers.code,
          detail: customers.mobile,
          storeName: customers.storeName,
        })
        .from(customers)
        .where(
          or(
            ilike(customers.name, searchTerm),
            ilike(customers.code, searchTerm),
            ilike(customers.mobile, searchTerm),
            ilike(customers.storeName, searchTerm)
          )
        )
        .limit(6),

      db
        .select({
          id: invoices.id,
          title: invoices.invoiceNumber,
          code: invoices.invoiceNumber,
          detail: invoices.grandTotal,
          notes: invoices.notes,
        })
        .from(invoices)
        .where(
          or(
            ilike(invoices.invoiceNumber, searchTerm),
            ilike(invoices.notes, searchTerm)
          )
        )
        .limit(6),

      db
        .select({
          id: products.id,
          title: products.name,
          code: products.code,
          detail: products.category,
        })
        .from(products)
        .where(
          or(
            ilike(products.name, searchTerm),
            ilike(products.code, searchTerm),
            ilike(products.category, searchTerm)
          )
        )
        .limit(6),

      db
        .select({
          id: rawMaterials.id,
          title: rawMaterials.name,
          code: rawMaterials.code,
          detail: rawMaterials.unit,
        })
        .from(rawMaterials)
        .where(
          or(
            ilike(rawMaterials.name, searchTerm),
            ilike(rawMaterials.code, searchTerm)
          )
        )
        .limit(6),

      db
        .select({
          id: suppliers.id,
          title: suppliers.name,
          code: suppliers.code,
          detail: suppliers.mobile,
        })
        .from(suppliers)
        .where(
          or(
            ilike(suppliers.name, searchTerm),
            ilike(suppliers.code, searchTerm),
            ilike(suppliers.contactPerson, searchTerm)
          )
        )
        .limit(6),

      db
        .select({
          id: projects.id,
          title: projects.name,
          code: projects.code,
          detail: projects.status,
        })
        .from(projects)
        .where(
          or(
            ilike(projects.name, searchTerm),
            ilike(projects.code, searchTerm)
          )
        )
        .limit(6),

      db
        .select({
          id: employees.id,
          title: employees.name,
          code: employees.code,
          detail: employees.role,
        })
        .from(employees)
        .where(
          or(
            ilike(employees.name, searchTerm),
            ilike(employees.code, searchTerm),
            ilike(employees.mobile, searchTerm)
          )
        )
        .limit(6),

      db
        .select({
          id: accounts.id,
          title: accounts.name,
          code: accounts.code,
          detail: accounts.bankName,
        })
        .from(accounts)
        .where(
          or(
            ilike(accounts.name, searchTerm),
            ilike(accounts.code, searchTerm),
            ilike(accounts.bankName, searchTerm)
          )
        )
        .limit(6),
    ]);

    const results = [
      ...matchedCustomers.map((item) => ({
        ...item,
        type: "customer",
        typeLabel: "مشتری",
        subtext: item.storeName ? `${item.code || ""} - ${item.storeName}` : (item.code || item.detail),
      })),
      ...matchedInvoices.map((item) => ({
        ...item,
        type: "invoice",
        typeLabel: "فاکتور",
        subtext: item.detail ? `${Number(item.detail).toLocaleString("fa-IR")} تومان` : item.code,
      })),
      ...matchedProducts.map((item) => ({
        ...item,
        type: "product",
        typeLabel: "محصول",
        subtext: item.detail ? `${item.code || ""} - دسته‌بندی: ${item.detail}` : item.code,
      })),
      ...matchedRawMaterials.map((item) => ({
        ...item,
        type: "raw_material",
        typeLabel: "ماده اولیه",
        subtext: item.detail ? `${item.code || ""} - واحد: ${item.detail}` : item.code,
      })),
      ...matchedSuppliers.map((item) => ({
        ...item,
        type: "supplier",
        typeLabel: "تامین‌کننده",
        subtext: item.detail || item.code,
      })),
      ...matchedProjects.map((item) => ({
        ...item,
        type: "project",
        typeLabel: "پروژه",
        subtext: item.code || "پروژه فعال",
      })),
      ...matchedEmployees.map((item) => ({
        ...item,
        type: "employee",
        typeLabel: "همکار / ویزیتور",
        subtext: item.detail === "visitor" ? "ویزیتور" : item.detail === "accountant" ? "حسابدار" : item.code,
      })),
      ...matchedAccounts.map((item) => ({
        ...item,
        type: "account",
        typeLabel: "حساب بانکی / صندوق",
        subtext: item.detail ? `${item.code} - ${item.detail}` : item.code,
      })),
    ];

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
