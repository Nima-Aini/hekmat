"use client";
import { retryableRequest } from "@/lib/retryableRequest";

import React, { useEffect, useState, useRef } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import {
  ShoppingBag,
  Plus,
  Printer,
  RotateCcw,
  RefreshCw,
  Search,
  CheckCircle,
  X,
  User,
  DollarSign,
  FileText,
  Calendar,
  CreditCard,
  Building,
  Download,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Tag,
  Edit3,
  Trash2
} from "lucide-react";
import { toJalaliDate, formatMoney, formatMoneyDual, formatRial, formatNumber } from "@/lib/dateUtils";
import { numberToPersianWords } from "@/lib/numberToWords";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { triggerInvoicePrint, downloadInvoiceJpg } from "@/lib/invoicePrintHelper";

export interface InvoiceItemFormItem {
  productId?: string | null;
  isCustom?: boolean;
  productName?: string;
  customUnit?: string;
  customNotes?: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
}

export const InvoicesView: React.FC<{ selectedProjectId: string | null }> = ({ selectedProjectId }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const createRequest = useRef<{ payload: string; key: string } | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const [reversingInvoice, setReversingInvoice] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloadingJpg, setDownloadingJpg] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [editingFullInvoice, setEditingFullInvoice] = useState<any | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    id: "",
    invoiceNumber: "",
    customerId: "",
    projectId: "",
    employeeId: "",
    invoiceDate: null as Date | null,
    dueDate: null as Date | null,
    invoiceDiscount: 0,
    items: [] as InvoiceItemFormItem[],
    notes: "",
  });

  const [invoicePayments, setInvoicePayments] = useState<any[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    accountId: "",
    paymentMethod: "pos",
    referenceNumber: "",
    notes: "",
    paymentDate: new Date() as Date | null,
  });

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Form State
  const [form, setForm] = useState({
    customerId: "",
    projectId: selectedProjectId || "",
    salesMode: "direct",
    employeeId: "",
    invoiceDate: new Date() as Date | null,
    dueDate: null as Date | null,
    invoiceDiscount: 0,
    items: [] as InvoiceItemFormItem[],
    initialPaymentAmount: 0,
    initialPaymentAccountId: "",
    initialPaymentDate: new Date() as Date | null,
    notes: "",
  });

  const [specialProducts, setSpecialProducts] = useState<any[]>([]);
  const [employeeProductAccess, setEmployeeProductAccess] = useState<{
    canSellAllProducts: boolean;
    allowedProductIds: string[];
    allowedSpecialProductIds: string[];
  } | null>(null);

  const loadEmployeeProductAccess = async (empId: string | null) => {
    if (!empId) {
      setEmployeeProductAccess(null);
      return;
    }
    try {
      const res = await fetch(`/api/employees/${empId}/product-access`).then((r) => r.json());
      if (res.success && res.data) {
        setEmployeeProductAccess({
          canSellAllProducts: res.data.canSellAllProducts !== false,
          allowedProductIds: Array.isArray(res.data.allowedProductIds) ? res.data.allowedProductIds : [],
          allowedSpecialProductIds: Array.isArray(res.data.allowedSpecialProductIds) ? res.data.allowedSpecialProductIds : [],
        });
      } else {
        setEmployeeProductAccess(null);
      }
    } catch (err) {
      console.error("Error loading employee product access:", err);
      setEmployeeProductAccess(null);
    }
  };

  const getCombinedProductsList = () => {
    const list: any[] = [];
    const seenIds = new Set<string>();
    products.forEach((p) => {
      const isSpec = !!p.isSpecial;
      seenIds.add(p.id);
      list.push({
        id: p.id,
        name: isSpec ? `[اختصاصی] ${p.name}` : p.name,
        code: p.code,
        unit: p.unit,
        category: p.category || (isSpec ? "اختصاصی" : "عمومی"),
        basePrice: Number(p.basePrice) || 0,
        effectivePrice: Number(p.effectivePrice ?? p.basePrice) || 0,
        stockQuantity: Number(p.stockQuantity) || 0,
        isSpecial: isSpec,
        hasProjectOverride: p.hasProjectOverride,
      });
    });
    specialProducts.forEach((sp) => {
      if (!seenIds.has(sp.id)) {
        seenIds.add(sp.id);
        list.push({
          id: sp.id,
          name: `[اختصاصی] ${sp.name}`,
          code: sp.code,
          unit: sp.unit,
          category: sp.category || "اختصاصی",
          basePrice: Number(sp.basePrice) || 0,
          effectivePrice: Number(sp.basePrice) || 0,
          stockQuantity: Number(sp.stockQuantity) || 0,
          isSpecial: true,
          hasProjectOverride: false,
        });
      }
    });
    return list;
  };

  const getFilteredProducts = () => {
    const combined = getCombinedProductsList();
    if (!employeeProductAccess) {
      return combined;
    }
    const { canSellAllProducts, allowedProductIds, allowedSpecialProductIds } = employeeProductAccess;
    if (canSellAllProducts) {
      return combined;
    }
    return combined.filter((p) => {
      if (p.isSpecial) {
        return allowedSpecialProductIds.includes(p.id);
      } else {
        return allowedProductIds.includes(p.id);
      }
    });
  };

  useEffect(() => {
    if (isAddModalOpen) {
      loadEmployeeProductAccess(form.employeeId || null);
    }
  }, [form.employeeId, isAddModalOpen]);

  useEffect(() => {
    if (editingFullInvoice) {
      loadEmployeeProductAccess(editForm.employeeId || null);
    }
  }, [editForm.employeeId, editingFullInvoice]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const projParam = selectedProjectId ? `?projectId=${selectedProjectId}` : "";
      const firstCustomersPage = await fetch("/api/customers?page=1&pageSize=100").then((r) => r.json());
      const customerPages = firstCustomersPage.success && firstCustomersPage.pagination?.totalPages > 1
        ? await Promise.all(Array.from({ length: Math.min(firstCustomersPage.pagination.totalPages - 1, 49) }, (_, index) => fetch(`/api/customers?page=${index + 2}&pageSize=100`).then((r) => r.json())))
        : [];
      const custRes = { ...firstCustomersPage, customers: [ ...(firstCustomersPage.customers || []), ...customerPages.flatMap((page) => page.success ? (page.customers || []) : []) ] };
      const [invRes, projRes, prodRes, accRes, empRes, settRes, specRes] = await Promise.all([
        fetch(`/api/invoices${projParam}`).then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
        fetch(selectedProjectId ? `/api/products?projectId=${selectedProjectId}` : "/api/products").then((r) => r.json()),
        fetch("/api/accounts").then((r) => r.json()),
        fetch("/api/employees").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
        fetch("/api/special-products").then((r) => r.json()),
      ]);

      if (invRes.success) setInvoices(invRes.invoices || []);
      if (custRes.success) setCustomers(custRes.customers || []);
      if (projRes.success) setProjects(projRes.projects || []);
      if (prodRes.success) setProducts(prodRes.products || []);
      if (accRes.success) setAccounts(accRes.accounts || []);
      if (empRes.success) setEmployees(empRes.employees || []);
      if (settRes?.success && settRes.settings) setSystemSettings(settRes.settings);
      if (specRes.success) setSpecialProducts(specRes.specialProducts || []);
    } catch (err) {
      console.error("Error fetching invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleSettingsUpdate = () => {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.settings) {
            setSystemSettings(data.settings);
          }
        })
        .catch((err) => console.error("Error refreshing settings in InvoicesView:", err));
    };

    window.addEventListener("akma:settings-updated", handleSettingsUpdate);
    return () => window.removeEventListener("akma:settings-updated", handleSettingsUpdate);
  }, [selectedProjectId]);

  const loadProductsForProject = async (projId: string) => {
    try {
      const url = projId ? `/api/products?projectId=${projId}` : "/api/products";
      const res = await fetch(url).then((r) => r.json());
      if (res.success && res.products) {
        setProducts(res.products);
        // Automatically re-price existing items in the invoice form based on project overrides
        setForm((prev) => {
          const updatedItems = prev.items.map((item) => {
            const matched = res.products.find((p: any) => p.id === item.productId);
            if (matched) {
              return {
                ...item,
                unitPrice: matched.effectivePrice ?? matched.basePrice,
              };
            }
            return item;
          });
          return { ...prev, items: updatedItems };
        });
      }
    } catch (err) {
      console.error("Failed to load project prices:", err);
    }
  };

  const handleProjectSelect = (projId: string) => {
    setForm((prev) => ({ ...prev, projectId: projId }));
    loadProductsForProject(projId);
  };

  const handleCustomerSelect = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    setForm((prev) => ({
      ...prev,
      customerId,
      employeeId: cust?.assignedEmployeeId || prev.employeeId,
    }));
  };

  const openAddModal = () => {
    const defaultProjId = selectedProjectId || (projects[0]?.id || "");
    const defaultCust = customers[0];
    const list = getFilteredProducts();
    setForm({
      customerId: defaultCust?.id || "",
      projectId: defaultProjId,
      salesMode: "direct",
      employeeId: defaultCust?.assignedEmployeeId || "",
      invoiceDate: new Date(),
      dueDate: null,
      invoiceDiscount: 0,
      items: list.length > 0
        ? [{ isCustom: false, productId: list[0].id, quantity: 1, unitPrice: list[0].effectivePrice ?? list[0].basePrice, discountAmount: 0 }]
        : [],
      initialPaymentAmount: 0,
      initialPaymentAccountId: accounts[0]?.id || "",
      initialPaymentDate: new Date(),
      notes: "",
    });
    if (defaultProjId) {
      loadProductsForProject(defaultProjId);
    }
    setIsAddModalOpen(true);
  };

  const handleProductChange = (index: number, productId: string) => {
    const list = getFilteredProducts();
    const prod = list.find((p) => p.id === productId);
    if (!prod) return;
    const updated = [...form.items];
    updated[index] = {
      ...updated[index],
      isCustom: false,
      productId,
      unitPrice: prod.effectivePrice ?? prod.basePrice,
    };
    setForm({ ...form, items: updated });
  };

  const addLineItem = () => {
    const list = getFilteredProducts();
    if (list.length > 0) {
      const defaultProd = list[0];
      setForm({
        ...form,
        items: [
          ...form.items,
          {
            isCustom: false,
            productId: defaultProd.id,
            quantity: 1,
            unitPrice: defaultProd.effectivePrice ?? defaultProd.basePrice,
            discountAmount: 0,
          },
        ],
      });
    }
  };

  const addCustomLineItem = () => setForm({ ...form, items: [...form.items, { isCustom: true, productName: "", customUnit: "عدد", quantity: 1, unitPrice: 0, discountAmount: 0 }] });

  const removeLineItem = (index: number) => {
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index),
    });
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId || form.items.length === 0) {
      alert("لطفاً خریدار و حداقل یک قلم کالا را مشخص نمایید.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        customerId: form.customerId,
        projectId: form.projectId || null,
        salesMode: form.salesMode,
        employeeId: form.employeeId || null,
        invoiceDate: form.invoiceDate ? form.invoiceDate.toISOString() : undefined,
        dueDate: form.dueDate ? form.dueDate.toISOString() : undefined,
        invoiceDiscount: form.invoiceDiscount,
        items: form.items.map((it) => ({
          productId: it.productId,
          isCustom: Boolean(it.isCustom),
          productName: it.productName,
          customUnit: it.customUnit,
          customNotes: undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountAmount: it.discountAmount || 0,
        })),
        notes: form.notes,
      };

      if (form.initialPaymentAmount > 0 && form.initialPaymentAccountId) {
        payload.initialPayment = {
          amount: form.initialPaymentAmount,
          accountId: form.initialPaymentAccountId,
          paymentMethod: "pos",
          paymentDate: form.initialPaymentDate ? form.initialPaymentDate.toISOString() : undefined,
        };
      }

      const serialized = JSON.stringify(payload);
      if (!createRequest.current || createRequest.current.payload !== serialized) createRequest.current = { payload: serialized, key: crypto.randomUUID() };
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": createRequest.current!.key },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success) {
        createRequest.current = null;
        setIsAddModalOpen(false);
        await fetchData();
      } else {
        alert(res.error || "خطا در صدور فاکتور");
      }
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط");
    } finally {
      setSaving(false);
    }
  };

  // Full Edit Modal Handlers
  const openEditFullInvoice = async (inv: any) => {
    const res = await fetch(`/api/invoices/${inv.id}`).then((r) => r.json());
    if (!res.success) return alert(res.error || "خطا در دریافت اطلاعات فاکتور");

    const list = getFilteredProducts();
    setEditingFullInvoice(res);
    setEditForm({
      id: res.invoice.id,
      invoiceNumber: res.invoice.invoiceNumber || "",
      customerId: res.invoice.customerId || "",
      projectId: res.invoice.projectId || "",
      employeeId: res.invoice.employeeId || "",
      invoiceDate: res.invoice.invoiceDate ? new Date(res.invoice.invoiceDate) : null,
      dueDate: res.invoice.dueDate ? new Date(res.invoice.dueDate) : null,
      invoiceDiscount: Number(res.invoice.invoiceDiscount) || 0,
      items: res.items && res.items.length > 0
        ? res.items.map((i: any) => ({
            productId: i.productId || i.specialProductId || null,
            isCustom: Boolean(i.isCustom),
            productName: i.productNameSnapshot || "",
            customUnit: i.customUnit || "عدد",
            customNotes: "",
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            discountAmount: Number(i.discountAmount) || 0,
          }))
        : list.length > 0
        ? [{ isCustom: false, productId: list[0].id, quantity: 1, unitPrice: list[0].effectivePrice ?? list[0].basePrice, discountAmount: 0 }]
        : [],
      notes: res.invoice.notes || "",
    });
  };

  const handleEditProductChange = (index: number, productId: string) => {
    const list = getFilteredProducts();
    const prod = list.find((p) => p.id === productId);
    if (!prod) return;
    const updated = [...editForm.items];
    updated[index] = {
      ...updated[index],
      isCustom: false,
      productId,
      unitPrice: prod.effectivePrice ?? prod.basePrice,
    };
    setEditForm({ ...editForm, items: updated });
  };

  const addEditLineItem = () => {
    const list = getFilteredProducts();
    if (list.length > 0) {
      const defaultProd = list[0];
      setEditForm({
        ...editForm,
        items: [
          ...editForm.items,
          {
            isCustom: false,
            productId: defaultProd.id,
            quantity: 1,
            unitPrice: defaultProd.effectivePrice ?? defaultProd.basePrice,
            discountAmount: 0,
          },
        ],
      });
    }
  };
  const addEditCustomLineItem = () => setEditForm({ ...editForm, items: [...editForm.items, { isCustom: true, productName: "", customUnit: "عدد", quantity: 1, unitPrice: 0, discountAmount: 0 }] });

  const removeEditLineItem = (index: number) => {
    setEditForm({
      ...editForm,
      items: editForm.items.filter((_, i) => i !== index),
    });
  };

  const handleSaveEditedInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.customerId || editForm.items.length === 0) {
      alert("خریدار و حداقل یک قلم کالا الزامی هستند.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${editForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: editForm.customerId,
          projectId: editForm.projectId || null,
          employeeId: editForm.employeeId || null,
          manualInvoiceNumber: editForm.invoiceNumber,
          invoiceDate: editForm.invoiceDate ? editForm.invoiceDate.toISOString() : undefined,
          dueDate: editForm.dueDate ? editForm.dueDate.toISOString() : undefined,
          invoiceDiscount: editForm.invoiceDiscount,
          items: editForm.items.map((it) => ({
            productId: it.productId,
            isCustom: Boolean(it.isCustom),
            productName: it.productName,
            customUnit: it.customUnit,
            customNotes: undefined,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountAmount: it.discountAmount || 0,
          })),
          notes: editForm.notes,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setEditingFullInvoice(null);
        await fetchData();
      } else {
        alert(res.error || "خطا در ویرایش فاکتور");
      }
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط");
    } finally {
      setSaving(false);
    }
  };

  const handleReverseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingInvoice || !reversalReason.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${reversingInvoice.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reversalReason }),
      }).then((r) => r.json());

      if (res.success) {
        setReversingInvoice(null);
        setReversalReason("");
        await fetchData();
      } else {
        alert(res.error || "خطا در ابطال فاکتور");
      }
    } catch (err: any) {
      alert(err.message || "خطا در ابطال فاکتور");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deletingInvoice) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${deletingInvoice.id}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success) {
        setDeletingInvoice(null);
        await fetchData();
      } else {
        alert(res.error || "خطا در حذف فاکتور");
      }
    } catch (err: any) {
      alert(err.message || "خطا در برقراری ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  const openEditInvoice = async (inv: any) => {
    const res = await fetch(`/api/invoices/${inv.id}`).then((r) => r.json());
    if (!res.success) return alert(res.error || "خطا در بارگذاری فاکتور");
    setEditingInvoice({
      ...res.invoice,
      dueDate: res.invoice.dueDate ? String(res.invoice.dueDate).slice(0, 10) : "",
    });
    setInvoicePayments(res.payments || []);
    setPaymentForm({
      amount: Number(res.invoice.balanceDue) || 0,
      accountId: accounts[0]?.id || "",
      paymentMethod: "pos",
      referenceNumber: "",
      notes: "",
      paymentDate: new Date(),
    });
  };

  const openViewInvoice = async (inv: any) => {
    const res = await fetch(`/api/invoices/${inv.id}`).then((r) => r.json());
    if (res.success) {
      setViewingInvoice(res);
    } else {
      alert(res.error || "خطا در دریافت اطلاعات فاکتور");
    }
  };

  const addInvoicePayment = async () => {
    if (!editingInvoice || !paymentForm.accountId || paymentForm.amount <= 0) {
      return alert("مبلغ و حساب واریزی را به درستی مشخص نمایید.");
    }
    setSaving(true);
    try {
      const res = await retryableRequest("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: editingInvoice.id,
          customerId: editingInvoice.customerId,
          projectId: editingInvoice.projectId,
          accountId: paymentForm.accountId,
          amount: paymentForm.amount,
          paymentMethod: paymentForm.paymentMethod,
          referenceNumber: paymentForm.referenceNumber,
          notes: paymentForm.notes,
          paymentDate: paymentForm.paymentDate ? paymentForm.paymentDate.toISOString() : undefined,
        }),
      }).then((r) => r.json());

      if (!res.success) throw new Error(res.error || "خطا در ثبت پرداخت");

      const next = await fetch(`/api/invoices/${editingInvoice.id}`).then((r) => r.json());
      if (next.success) {
        setEditingInvoice(next.invoice);
        setInvoicePayments(next.payments || []);
      }
      setPaymentForm({
        amount: 0,
        accountId: accounts[0]?.id || "",
        paymentMethod: "pos",
        referenceNumber: "",
        notes: "",
        paymentDate: new Date(),
      });
      await fetchData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadJpg = async () => {
    if (!viewingInvoice) return;
    setDownloadingJpg(true);
    try {
      await downloadInvoiceJpg(
        {
          ...viewingInvoice,
          sellerInfo: systemSettings,
        },
        printAreaRef.current
      );
    } finally {
      setDownloadingJpg(false);
    }
  };

  const handlePrintInvoice = () => {
    if (!viewingInvoice) return;
    triggerInvoicePrint({
      ...viewingInvoice,
      sellerInfo: systemSettings,
    });
  };

  const calculateSubtotal = () => {
    return form.items.reduce((acc, item) => acc + item.quantity * item.unitPrice - (item.discountAmount || 0), 0);
  };

  const calculateGrandTotal = () => {
    const sub = calculateSubtotal();
    return Math.max(0, sub - (form.invoiceDiscount || 0));
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchQuery =
      inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.employeeName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchPayment = paymentFilter === "all" || inv.paymentStatus === paymentFilter;

    return matchQuery && matchStatus && matchPayment;
  });

  return (
    <div className="space-y-6" id="invoices-view-container">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-purple-400" />
            سیستم صدور، تسویه و حسابداری فاکتورهای فروش
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            یکپارچه با خزانه‌داری، حساب‌های بانکی، کارتابل ویزیتورها و انبارداری محصولات
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-purple-400" : ""}`} />
            بروزرسانی
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            صدور فاکتور جدید
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="جستجو بر اساس شماره فاکتور، نام خریدار یا ویزیتور..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-2.5 pr-10 pl-4 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-300 focus:border-purple-500 focus:outline-none"
          >
            <option value="all">همه وضعیت‌ها (صادر/ابطال)</option>
            <option value="issued">فقط فاکتورهای معتبر</option>
            <option value="cancelled">فقط فاکتورهای ابطال شده</option>
            <option value="reversed">فقط مرجوعی‌ها</option>
          </select>
        </div>

        <div>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-300 focus:border-purple-500 focus:outline-none"
          >
            <option value="all">همه وضعیت‌های تسویه</option>
            <option value="paid">کاملاً تسویه شده</option>
            <option value="partial">پرداخت ناقص</option>
            <option value="unpaid">کاملاً تسویه نشده (بدهکار)</option>
          </select>
        </div>
      </div>

      {/* Invoices List */}
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold">
              <tr>
                <th className="py-3.5 px-4">شماره فاکتور</th>
                <th className="py-3.5 px-4">خریدار / فروشگاه</th>
                <th className="py-3.5 px-4">ویزیتور / مسئول فروش</th>
                <th className="py-3.5 px-4">پروژه</th>
                <th className="py-3.5 px-4">مبلغ کل (تومان)</th>
                <th className="py-3.5 px-4">تسویه شده / مانده</th>
                <th className="py-3.5 px-4">تاریخ صدور</th>
                <th className="py-3.5 px-4 text-center">وضعیت</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-purple-500 mb-2" />
                    در حال بارگذاری فاکتورها...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    هیچ فاکتوری با شرایط انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-400" />
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-200">
                      <div>{inv.customerName || "—"}</div>
                      {inv.customerStore && <div className="text-[11px] text-slate-500 font-normal">{inv.customerStore}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      {inv.employeeName && inv.employeeName !== "-" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-purple-950/40 border border-purple-800/40 px-2.5 py-1 text-[11px] text-purple-300 font-medium">
                          <User className="h-3 w-3 text-purple-400" />
                          {inv.employeeName}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">مستقیم / دفتر</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="rounded-xl bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
                        {inv.projectName || "عمومی"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {formatMoney(inv.grandTotal)}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="text-emerald-400">{formatMoney(inv.paidAmount)}</div>
                      {Number(inv.balanceDue) > 0 && (
                        <div className="text-rose-400 text-[11px]">مانده: {formatMoney(inv.balanceDue)}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {toJalaliDate(inv.invoiceDate)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {inv.status === "cancelled" || inv.status === "reversed" ? (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-rose-950/60 border border-rose-500/30 px-2.5 py-1 text-[11px] text-rose-300">
                          ابطال شده
                        </span>
                      ) : inv.paymentStatus === "paid" ? (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 text-[11px] text-emerald-300">
                          <CheckCircle className="h-3 w-3" />
                          تسویه کامل{inv.settlementDate ? ` — ${toJalaliDate(inv.settlementDate)}` : ""}
                        </span>
                      ) : inv.paymentStatus === "partial" ? (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 text-[11px] text-amber-300">
                          تسویه ناقص
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-rose-950/60 border border-rose-500/30 px-2.5 py-1 text-[11px] text-rose-300">
                          تسویه نشده
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openViewInvoice(inv)}
                          title="مشاهده و چاپ رسمی فاکتور"
                          className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:text-white hover:border-purple-500 transition"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditFullInvoice(inv)}
                          title="ویرایش کامل فاکتور و اقلام"
                          className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-cyan-400 hover:text-cyan-300 hover:border-cyan-500 transition"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditInvoice(inv)}
                          title="ثبت دریافتی و تسویه حساب"
                          className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500 transition"
                        >
                          <CreditCard className="h-4 w-4" />
                        </button>
                        {inv.status !== "cancelled" && inv.status !== "reversed" && (
                          <button
                            onClick={() => {
                              setReversingInvoice(inv);
                              setReversalReason("");
                            }}
                            title="ابطال فاکتور و بازگردانی انبار"
                            className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-amber-400 hover:text-amber-300 hover:border-amber-500 transition"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingInvoice(inv)}
                          title="حذف فاکتور و بازگردانی انبار"
                          className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-rose-500 hover:text-rose-400 hover:border-rose-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Create Invoice */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-purple-400" />
                صدور فاکتور فروش رسمی جدید
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    خریدار / مشتری <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={form.customerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-2.5 text-white"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.storeName ? `(${c.storeName})` : ""} - موبایل: {c.mobile}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">پروژه و پلن قیمت‌گذاری</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-2.5 text-white"
                  >
                    <option value="">بدون پروژه (قیمت پایه سازمانی)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        پروژه: {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ویزیتور / مسئول فروش</label>
                  <select
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-2.5 text-white"
                  >
                    <option value="">فروش مستقیم (بدون کمیسیون ویزیتور)</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.role || "همکار"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Jalali Dates Row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800/80">
                <JalaliDatePicker
                  label="تاریخ صدور فاکتور (شمسی)"
                  value={form.invoiceDate}
                  onChange={(d) => setForm({ ...form, invoiceDate: d })}
                  required
                />
                <JalaliDatePicker
                  label="سررسید پرداخت و تسویه (شمسی)"
                  value={form.dueDate}
                  onChange={(d) => setForm({ ...form, dueDate: d })}
                  placeholder="اختیاری - مثال: 1404/02/15"
                />
              </div>

              {/* Line Items Table */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-200 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-purple-400" />
                    اقلام و کالاهای فاکتور ({form.items.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-950/40 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-900/60 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      افزودن کالا
                    </button>
                    <button type="button" onClick={addCustomLineItem} className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/50 transition">
                      <Plus className="h-3.5 w-3.5" /> افزودن هزینه / آیتم دستی
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-right text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-semibold">
                      <tr>
                        <th className="p-3 text-center w-12">ردیف</th>
                        <th className="p-3">نام و نوع محصول</th>
                        <th className="p-3 text-center w-24">تعداد / مقدار</th>
                        <th className="p-3 text-center w-36">قیمت واحد (تومان)</th>
                        <th className="p-3 text-center w-32">تخفیف سطر (تومان)</th>
                        <th className="p-3 text-left w-32">جمع سطر (تومان)</th>
                        <th className="p-3 text-center w-12">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-950">
                      {form.items.map((item, idx) => {
                        const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
                        const filteredProducts = getFilteredProducts();
                        const prod = item.productId ? filteredProducts.find((p) => p.id === item.productId) : null;

                        return (
                          <tr key={idx}>
                            <td className="p-3 font-bold text-slate-500 text-center">{idx + 1}</td>
                            <td className="p-3">
                              <div className="space-y-2">
                                {item.isCustom ? (
                                  <input value={item.productName || ""} placeholder="عنوان هزینه یا خدمت" onChange={(e) => { const updated = [...form.items]; updated[idx].productName = e.target.value; setForm({ ...form, items: updated }); }} className="w-full rounded-xl border border-amber-500/30 bg-slate-900 p-2 text-white" />
                                ) : (
                                <div>
                                  <select
                                    value={item.productId || ""}
                                    onChange={(e) => handleProductChange(idx, e.target.value)}
                                    className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-white"
                                  >
                                    {filteredProducts.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} (موجودی: {formatNumber(p.stockQuantity)} {p.unit}) {p.isSpecial ? "⭐" : ""}
                                      </option>
                                    ))}
                                  </select>
                                  {prod?.hasProjectOverride && (
                                    <span className="text-[10px] text-amber-400 flex items-center gap-1 mt-1">
                                      <Tag className="h-2.5 w-2.5" />
                                      نرخ ویژه پروژه اعمال شد
                                    </span>
                                  )}
                                </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  const updated = [...form.items];
                                  updated[idx].quantity = val;
                                  setForm({ ...form, items: updated });
                                }}
                                className="w-20 rounded-xl border border-slate-800 bg-slate-900 p-2 text-center text-white mx-auto block font-mono"
                              />
                            </td>
                            <td className="p-3">
                              <MoneyInput
                                value={item.unitPrice}
                                onChange={(val) => {
                                  const updated = [...form.items];
                                  updated[idx].unitPrice = val;
                                  setForm({ ...form, items: updated });
                                }}
                                className="w-32 text-xs py-1.5 mx-auto"
                                unit="تومان"
                              />
                            </td>
                            <td className="p-3">
                              <MoneyInput
                                value={item.discountAmount}
                                onChange={(val) => {
                                  const updated = [...form.items];
                                  updated[idx].discountAmount = val;
                                  setForm({ ...form, items: updated });
                                }}
                                className="w-28 text-xs py-1.5 mx-auto"
                                unit="تومان"
                              />
                            </td>
                            <td className="p-3 font-mono font-bold text-white text-left">
                              {formatMoney(lineTotal)}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => removeLineItem(idx)}
                                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Initial Settlement */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-300 flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-emerald-400" />
                    تسویه اولیه و واریز نقدی (اختیاری)
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">مبلغ پیش‌پرداخت</label>
                      <MoneyInput
                        value={form.initialPaymentAmount}
                        onChange={(val) => setForm({ ...form, initialPaymentAmount: val })}
                        className="w-full text-xs py-2"
                        unit="تومان"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">حساب مقصد واریز</label>
                      <select
                        value={form.initialPaymentAccountId}
                        onChange={(e) => setForm({ ...form, initialPaymentAccountId: e.target.value })}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-white"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.bankName || "صندوق"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <JalaliDatePicker label="تاریخ واقعی پرداخت / تسویه" value={form.initialPaymentDate} onChange={(d) => setForm({ ...form, initialPaymentDate: d })} />
                </div>

                <div className="space-y-2 border-r border-slate-800 pr-4">
                  <div className="flex justify-between text-slate-400">
                    <span>جمع ناخالص:</span>
                    <span className="font-mono text-white">{formatMoney(calculateSubtotal())}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>تخفیف کلی فاکتور:</span>
                    <div className="w-36">
                      <MoneyInput
                        value={form.invoiceDiscount}
                        onChange={(val) => setForm({ ...form, invoiceDiscount: val })}
                        className="text-xs py-1"
                        unit="تومان"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-2">
                    <span>مبلغ قابل پرداخت نهایی:</span>
                    <span className="font-mono text-purple-400">{formatMoney(calculateGrandTotal())}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 text-left font-mono">
                    معادل: {formatRial(calculateGrandTotal())}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-2xl border border-slate-800 px-5 py-2.5 text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-purple-600/30 hover:opacity-95"
                >
                  {saving ? "در حال صدور فاکتور..." : "ثبت و صدور نهایی فاکتور"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reversal with reason */}
      {reversingInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReversingInvoice(null);
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-rose-400" />
                ابطال فاکتور #{reversingInvoice.invoiceNumber}
              </h3>
              <button onClick={() => setReversingInvoice(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-rose-300 bg-rose-950/40 p-3.5 rounded-2xl border border-rose-500/30 leading-relaxed">
              هشدار: با ابطال این فاکتور، کلیه کالاهای خروج یافته مجدداً به موجودی انبار بازگردانده شده و مانده بدهی مشتری و پورسانت ثبت شده کسر می‌گردد.
            </p>

            <form onSubmit={handleReverseInvoice} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  علت ابطال فاکتور <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  placeholder="علت ابطال را بنویسید (مثلاً: انصراف مشتری، مرجوعی، خطای ورود اطلاعات)..."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-3 text-white h-24 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReversingInvoice(null)}
                  className="rounded-2xl border border-slate-800 px-4 py-2.5 text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-rose-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500"
                >
                  {saving ? "در حال ابطال..." : "تأیید و ابطال فاکتور"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2.5: Delete Invoice Confirmation */}
      {deletingInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingInvoice(null);
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-rose-900/50 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-500" />
                حذف دائم فاکتور #{deletingInvoice.invoiceNumber}
              </h3>
              <button onClick={() => setDeletingInvoice(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-950/40 text-xs text-rose-300 leading-relaxed space-y-2">
              <p className="font-bold">آیا از حذف دائم این فاکتور اطمینان دارید؟</p>
              <p>
                مبلغ فاکتور: {formatMoney(deletingInvoice.grandTotal)} | خریدار: {deletingInvoice.customerName}
              </p>
              <p className="text-[11px] text-rose-400">
                توجه: موجودی کالا فقط در صورت فعال بودن فاکتور بازگردانده می‌شود. دریافت‌های واقعی بانکی/صندوق حذف یا کم نمی‌شوند و فقط اتصال آن‌ها به فاکتور برداشته می‌شود؛ پورسانت‌های تسویه‌نشده نیز برگشت داده خواهند شد.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingInvoice(null)}
                className="rounded-2xl border border-slate-800 px-4 py-2.5 text-xs text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDeleteInvoice}
                className="rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500"
              >
                {saving ? "در حال حذف..." : "تأیید و حذف فاکتور"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Payment & Settlement */}
      {editingInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingInvoice(null);
          }}
        >
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-400" />
                  مدیریت تسویه و پرداخت فاکتور #{editingInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  خریدار: {editingInvoice.customerName} | مبلغ کل: {formatMoney(editingInvoice.grandTotal)}
                </p>
              </div>
              <button onClick={() => setEditingInvoice(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-slate-400">مبلغ کل فاکتور</div>
                <div className="font-mono font-bold text-white text-sm mt-1">{formatMoney(editingInvoice.grandTotal)}</div>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/30 p-3">
                <div className="text-emerald-400">پرداخت شده تا کنون</div>
                <div className="font-mono font-bold text-emerald-300 text-sm mt-1">{formatMoney(editingInvoice.paidAmount)}</div>
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-950/30 p-3">
                <div className="text-rose-400">مانده بدهی (طلب)</div>
                <div className="font-mono font-bold text-rose-300 text-sm mt-1">{formatMoney(editingInvoice.balanceDue)}</div>
              </div>
            </div>

            {/* History of Payments */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-300">سوابق تراکنش‌های پرداخت این فاکتور:</h4>
              {invoicePayments.length === 0 ? (
                <div className="p-3 text-center text-slate-500 bg-slate-900/40 rounded-xl">
                  هنوز هیچ پرداختی برای این فاکتور ثبت نشده است.
                </div>
              ) : (
                <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                  {invoicePayments.map((p) => (
                    <div key={p.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          <span>مبلغ: {formatMoney(p.amount)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          روش: {p.paymentMethod} | شماره پیگیری: {p.referenceNumber || "—"} | تاریخ: {toJalaliDate(p.paymentDate, { showTime: true })}
                        </div>
                      </div>
                      <span className="rounded-lg bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300">
                        موفق
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Payment */}
            {Number(editingInvoice.balanceDue) > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4 text-xs">
                <h4 className="font-bold text-slate-200 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-400" />
                  ثبت دریافت وجه جدید و واریز به حساب بانکی
                </h4>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-slate-400 mb-1">مبلغ واریزی</label>
                    <MoneyInput
                      value={paymentForm.amount}
                      onChange={(val) => setPaymentForm({ ...paymentForm, amount: val })}
                      className="w-full text-xs py-2"
                      unit="تومان"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">حساب بانکی / صندوق دریافت‌کننده</label>
                    <select
                      value={paymentForm.accountId}
                      onChange={(e) => setPaymentForm({ ...paymentForm, accountId: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.bankName || "حساب"}) - موجودی: {formatMoney(a.balance)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">روش پرداخت</label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white"
                    >
                      <option value="pos">کارتخوان (POS)</option>
                      <option value="card_transfer">کارت به کارت</option>
                      <option value="bank_transfer">حواله پایا / ساتنا</option>
                      <option value="cash">نقدی</option>
                      <option value="cheque">چک صیادی</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">شماره ارجاع / پیگیری</label>
                    <input
                      type="text"
                      placeholder="کد پیگیری تراکنش بانکی..."
                      value={paymentForm.referenceNumber}
                      onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-white"
                    />
                  </div>
                  <JalaliDatePicker label="تاریخ واقعی پرداخت / تسویه" value={paymentForm.paymentDate} onChange={(d) => setPaymentForm({ ...paymentForm, paymentDate: d })} />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={addInvoicePayment}
                    disabled={saving}
                    className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500"
                  >
                    {saving ? "در حال ثبت پرداخت..." : "ثبت پرداخت و بروزرسانی مانده"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="rounded-xl border border-slate-800 px-5 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Official Persian Invoice Print & JPG Export */}
      {viewingInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto print:p-0 print:m-0 print:bg-white print:static"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingInvoice(null);
          }}
        >
          <div className="w-full max-w-4xl rounded-3xl border border-slate-300 bg-white p-6 md:p-8 text-slate-900 shadow-2xl my-6 space-y-6 print:p-0 print:m-0 print:border-none print:shadow-none print:max-w-none">
            {/* Top Toolbar */}
            <div className="no-print flex justify-between items-center border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-purple-100 p-2 text-purple-700 font-bold text-xs">
                  پیش‌نمایش رسمی فاکتور
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  #{viewingInvoice.invoice.invoiceNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadJpg}
                  disabled={downloadingJpg}
                  className="flex items-center gap-1.5 rounded-xl border border-purple-600 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition shadow-sm cursor-pointer"
                >
                  <ImageIcon className="h-4 w-4" />
                  {downloadingJpg ? "در حال تولید تصویر..." : "دانلود تصویر فاکتور (JPG)"}
                </button>
                <button
                  onClick={handlePrintInvoice}
                  className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 transition shadow-md cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  چاپ و دانلود PDF فاکتور
                </button>
                <button
                  onClick={() => setViewingInvoice(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Persian Invoice Canvas */}
            <div
              ref={printAreaRef}
              id="persian-official-invoice"
              className="bg-white p-6 rounded-2xl border-2 border-slate-800 space-y-5 text-xs text-slate-900 font-sans"
              style={{ minHeight: "650px", direction: "rtl", backgroundColor: "#ffffff", color: "#0f172a" }}
            >
              {/* Header Box */}
              <div className="border-b-2 border-slate-800 pb-4" style={{ borderColor: "#1e293b" }}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h1 className="text-lg font-black tracking-tight text-slate-900" style={{ color: "#0f172a" }}>
                      {systemSettings?.businessName || "سازمان و صنایع بازرگانی حکمت آکما"}
                    </h1>
                    <p className="text-[11px] text-slate-600 font-medium" style={{ color: "#475569" }}>
                      صورتحساب فروش کالا و خدمات (فاکتور رسمی تجاری)
                    </p>
                  </div>

                  <div className="border border-slate-400 rounded-xl p-2.5 text-center min-w-44 bg-slate-50 space-y-1 text-[11px]" style={{ borderColor: "#94a3b8", backgroundColor: "#f8fafc" }}>
                    <div>
                      <span className="text-slate-500" style={{ color: "#64748b" }}>شماره سریال فاکتور: </span>
                      <span className="font-mono font-bold text-slate-900" style={{ color: "#0f172a" }}>{viewingInvoice.invoice.invoiceNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500" style={{ color: "#64748b" }}>تاریخ صدور: </span>
                      <span className="font-bold text-slate-900" style={{ color: "#0f172a" }}>{toJalaliDate(viewingInvoice.invoice.invoiceDate)}</span>
                    </div>
                    {viewingInvoice.invoice.settlementDate && <div><span className="text-slate-500" style={{ color: "#64748b" }}>تاریخ تسویه: </span><span className="font-bold text-slate-900" style={{ color: "#0f172a" }}>{toJalaliDate(viewingInvoice.invoice.settlementDate)}</span></div>}
                  </div>
                </div>
              </div>

              {/* Seller & Buyer Info Tables */}
              <div className="grid grid-cols-2 gap-3">
                {/* Seller Box */}
                <div className="border border-slate-400 rounded-xl p-3 bg-slate-50 space-y-1 text-[11px]" style={{ borderColor: "#94a3b8", backgroundColor: "#f8fafc" }}>
                  <div className="font-black text-slate-800 border-b border-slate-300 pb-1 flex items-center gap-1" style={{ color: "#1e293b", borderColor: "#cbd5e1" }}>
                    <Building className="h-3.5 w-3.5 text-slate-700" />
                    مشخصات فروشنده
                  </div>
                  <div>
                    <span className="text-slate-500" style={{ color: "#64748b" }}>نام فروشنده: </span>
                    <span className="font-bold text-slate-900" style={{ color: "#0f172a" }}>{systemSettings?.businessName || "شرکت حکمت آکما"}</span>
                  </div>
                  <div>
                    {systemSettings?.economicCode && (
                      <>
                        <span className="text-slate-500" style={{ color: "#64748b" }}>کد اقتصادی: </span>
                        <span className="font-mono font-bold text-slate-900" style={{ color: "#0f172a" }}>{systemSettings.economicCode}</span>
                        {systemSettings?.nationalId ? " | " : ""}
                      </>
                    )}
                    {systemSettings?.nationalId && (
                      <>
                        <span className="text-slate-500" style={{ color: "#64748b" }}>شناسه ملی: </span>
                        <span className="font-mono font-bold text-slate-900" style={{ color: "#0f172a" }}>{systemSettings.nationalId}</span>
                      </>
                    )}
                  </div>
                  {(systemSettings?.registrationNumber || systemSettings?.postalCode) && (
                    <div>
                      {systemSettings?.registrationNumber && (
                        <>
                          <span className="text-slate-500" style={{ color: "#64748b" }}>شماره ثبت: </span>
                          <span className="font-mono text-slate-900" style={{ color: "#0f172a" }}>{systemSettings.registrationNumber}</span>
                          {" | "}
                        </>
                      )}
                      {systemSettings?.postalCode && (
                        <>
                          <span className="text-slate-500" style={{ color: "#64748b" }}>کد پستی: </span>
                          <span className="font-mono text-slate-900" style={{ color: "#0f172a" }}>{systemSettings.postalCode}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500" style={{ color: "#64748b" }}>نشانی و تلفن: </span>
                    <span className="text-slate-900" style={{ color: "#0f172a" }}>
                      {systemSettings?.companyAddress ? (
                        <>
                          {systemSettings.companyAddress}
                          {systemSettings.companyPhone ? ` - تلفن: ${systemSettings.companyPhone}` : ""}
                        </>
                      ) : systemSettings?.companyPhone ? (
                        `تلفن: ${systemSettings.companyPhone}`
                      ) : (
                        "دفتر مرکزی - تلفن: ۰۲۱-۸۸۹۹۰۰۱۱"
                      )}
                    </span>
                  </div>
                  {systemSettings?.taxOffice && (
                    <div>
                      <span className="text-slate-500" style={{ color: "#64748b" }}>حوزه مالیاتی: </span>
                      <span className="font-bold text-slate-900" style={{ color: "#0f172a" }}>{systemSettings.taxOffice}</span>
                    </div>
                  )}
                </div>

                {/* Buyer Box */}
                <div className="border border-slate-400 rounded-xl p-3 bg-slate-50 space-y-1 text-[11px]" style={{ borderColor: "#94a3b8", backgroundColor: "#f8fafc" }}>
                  <div className="font-black text-slate-800 border-b border-slate-300 pb-1 flex items-center gap-1" style={{ color: "#1e293b", borderColor: "#cbd5e1" }}>
                    <User className="h-3.5 w-3.5 text-slate-700" />
                    مشخصات خریدار
                  </div>
                  <div><span className="text-slate-500" style={{ color: "#64748b" }}>نام خریدار / فروشگاه: </span><span className="font-bold text-slate-900" style={{ color: "#0f172a" }}>{viewingInvoice.invoice.customerName} {viewingInvoice.invoice.customerStore ? `(${viewingInvoice.invoice.customerStore})` : ""}</span></div>
                  <div><span className="text-slate-500" style={{ color: "#64748b" }}>شماره تماس / همراه: </span><span className="font-mono text-slate-900" style={{ color: "#0f172a" }}>{viewingInvoice.invoice.customerMobile || "—"}</span></div>
                  <div><span className="text-slate-500" style={{ color: "#64748b" }}>نشانی تحویل: </span><span className="text-slate-900" style={{ color: "#0f172a" }}>{viewingInvoice.invoice.customerAddress || "تهران - ارسال حضوری"}</span></div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden" style={{ borderColor: "#1e293b" }}>
                <table className="w-full text-right text-[11px] border-collapse">
                  <thead className="bg-slate-200 font-bold text-slate-800 border-b border-slate-800" style={{ backgroundColor: "#e2e8f0", color: "#1e293b", borderColor: "#1e293b" }}>
                    <tr>
                      <th className="p-2 border-r border-slate-400 text-center w-10" style={{ borderColor: "#94a3b8" }}>ردیف</th>
                      <th className="p-2 border-r border-slate-400" style={{ borderColor: "#94a3b8" }}>کد و شرح کالا یا خدمات</th>
                      <th className="p-2 border-r border-slate-400 text-center w-16" style={{ borderColor: "#94a3b8" }}>تعداد</th>
                      <th className="p-2 border-r border-slate-400 text-center w-14" style={{ borderColor: "#94a3b8" }}>واحد</th>
                      <th className="p-2 border-r border-slate-400 text-left w-28" style={{ borderColor: "#94a3b8" }}>مبلغ واحد (تومان)</th>
                      <th className="p-2 border-r border-slate-400 text-left w-24" style={{ borderColor: "#94a3b8" }}>تخفیف (تومان)</th>
                      <th className="p-2 text-left w-32">مبلغ کل (تومان)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 bg-white" style={{ backgroundColor: "#ffffff" }}>
                    {viewingInvoice.items.map((i: any, index: number) => (
                      <tr key={i.id || index} style={{ borderBottom: "1px solid #cbd5e1" }}>
                        <td className="p-2 border-r border-slate-300 text-center font-bold text-slate-700" style={{ borderColor: "#cbd5e1", color: "#0f172a" }}>{index + 1}</td>
                        <td className="p-2 border-r border-slate-300 font-bold text-slate-900" style={{ borderColor: "#cbd5e1", color: "#0f172a" }}>
                          {i.productNameSnapshot}
                          {i.productCode && <span className="text-[10px] text-slate-600 font-mono font-normal mr-2" style={{ color: "#334155" }}>[{i.productCode}]</span>}
                          {i.customNotes && <div className="text-[10px] text-slate-500 font-normal mt-0.5" style={{ color: "#64748b" }}>{i.customNotes}</div>}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-center font-bold font-mono text-slate-900" style={{ borderColor: "#cbd5e1", color: "#0f172a" }}>{formatNumber(i.quantity)}</td>
                        <td className="p-2 border-r border-slate-300 text-center text-slate-700" style={{ borderColor: "#cbd5e1", color: "#0f172a" }}>{i.productUnit || "عدد"}</td>
                        <td className="p-2 border-r border-slate-300 text-left font-mono font-medium text-slate-900" style={{ borderColor: "#cbd5e1", color: "#0f172a" }}>{formatMoney(i.unitPrice, "")}</td>
                        <td className="p-2 border-r border-slate-300 text-left font-mono font-medium text-slate-900" style={{ borderColor: "#cbd5e1", color: "#0f172a" }}>{formatMoney(i.discountAmount || 0, "")}</td>
                        <td className="p-2 text-left font-bold font-mono text-slate-900" style={{ color: "#0f172a" }}>{formatMoney(i.lineTotal, "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Box - ALL PRICES BLACK */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="border border-slate-300 rounded-xl p-3 bg-slate-50 text-[11px] space-y-2 flex flex-col justify-between" style={{ borderColor: "#cbd5e1", backgroundColor: "#f8fafc" }}>
                  <div>
                    <div className="text-slate-600 font-semibold mb-1" style={{ color: "#334155" }}>مبلغ کل قابل پرداخت به حروف:</div>
                    <div className="font-bold text-slate-900 leading-relaxed text-xs" style={{ color: "#0f172a" }}>
                      {numberToPersianWords(viewingInvoice.invoice.grandTotal, "تومان")}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1 font-mono font-medium" style={{ color: "#334155" }}>
                      معادل: {formatRial(viewingInvoice.invoice.grandTotal)}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-800 rounded-xl p-3 bg-slate-50 text-[11px] space-y-1.5" style={{ borderColor: "#1e293b", backgroundColor: "#f8fafc" }}>
                  <div className="flex justify-between text-slate-900" style={{ color: "#0f172a" }}>
                    <span>جمع اقلام:</span>
                    <span className="font-mono font-bold text-slate-900" style={{ color: "#0f172a" }}>{formatMoney(viewingInvoice.invoice.subtotal)}</span>
                  </div>
                  {Number(viewingInvoice.invoice.invoiceDiscount) > 0 && (
                    <div className="flex justify-between text-slate-900" style={{ color: "#0f172a" }}>
                      <span>تخفیف فاکتور:</span>
                      <span className="font-mono font-bold text-slate-900" style={{ color: "#0f172a" }}>{formatMoney(viewingInvoice.invoice.invoiceDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-black text-xs border-t border-slate-400 pt-1.5" style={{ borderColor: "#94a3b8", color: "#0f172a" }}>
                    <span>مبلغ کل فاکتور:</span>
                    <span className="font-mono font-black text-slate-900" style={{ color: "#0f172a" }}>{formatMoney(viewingInvoice.invoice.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold border-t border-slate-300 pt-1" style={{ borderColor: "#cbd5e1", color: "#0f172a" }}>
                    <span>مبلغ پرداخت شده:</span>
                    <span className="font-mono font-bold text-slate-900" style={{ color: "#0f172a" }}>{formatMoney(viewingInvoice.invoice.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold" style={{ color: "#0f172a" }}>
                    <span>مانده بدهی (طلب):</span>
                    <span className="font-mono font-bold text-slate-900" style={{ color: "#0f172a" }}>{formatMoney(viewingInvoice.invoice.balanceDue)}</span>
                  </div>
                </div>
              </div>

              {/* Signatures & Stamps */}
              <div className="grid grid-cols-2 gap-4 border-t-2 border-slate-800 pt-6 text-[11px]" style={{ borderColor: "#1e293b" }}>
                <div className="text-center space-y-8">
                  <span className="font-bold text-slate-900" style={{ color: "#0f172a" }}>
                    مهر و امضای فروشنده ({systemSettings?.businessName || "شرکت حکمت آکما"})
                  </span>
                  <div className="h-10 border-b border-dashed border-slate-400 mx-10" style={{ borderColor: "#94a3b8" }}></div>
                </div>
                <div className="text-center space-y-8">
                  <span className="font-bold text-slate-900" style={{ color: "#0f172a" }}>مهر و امضای خریدار / تحویل‌گیرنده کالا</span>
                  <div className="h-10 border-b border-dashed border-slate-400 mx-10" style={{ borderColor: "#94a3b8" }}></div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="no-print flex justify-between items-center pt-2">
              <button
                onClick={() => setViewingInvoice(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                بستن پیش‌نمایش
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadJpg}
                  disabled={downloadingJpg}
                  className="flex items-center gap-1.5 rounded-xl border border-purple-600 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition shadow-sm"
                >
                  <ImageIcon className="h-4 w-4" />
                  {downloadingJpg ? "در حال ذخیره تصویر..." : "دانلود تصویر (JPG)"}
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-md"
                >
                  <Printer className="h-4 w-4" />
                  چاپ فاکتور (PDF)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Full Invoice Editing Modal */}
      {editingFullInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingFullInvoice(null);
          }}
        >
          <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-cyan-400" />
                ویرایش کامل فاکتور #{editForm.invoiceNumber}
              </h3>
              <button onClick={() => setEditingFullInvoice(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedInvoice} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    خریدار / مشتری <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={editForm.customerId}
                    onChange={(e) => {
                      const cust = customers.find((c) => c.id === e.target.value);
                      setEditForm((prev) => ({
                        ...prev,
                        customerId: e.target.value,
                        employeeId: cust?.assignedEmployeeId || prev.employeeId,
                      }));
                    }}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-2.5 text-white"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.storeName ? `(${c.storeName})` : ""} - موبایل: {c.mobile}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">پروژه و پلن قیمت‌گذاری</label>
                  <select
                    value={editForm.projectId}
                    onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-2.5 text-white"
                  >
                    <option value="">پروژه پیش‌فرض / عمومی</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ویزیتور و همکار ثبت‌کننده</label>
                  <select
                    value={editForm.employeeId}
                    onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-2.5 text-white"
                  >
                    <option value="">-- فروش مستقیم / سازمانی --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role || "همکار"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">شماره فاکتور دستی / سیستمی:</label>
                  <input
                    type="text"
                    value={editForm.invoiceNumber}
                    onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-2.5 text-white font-mono"
                  />
                </div>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <JalaliDatePicker
                    label="تاریخ فاکتور (شمسی)"
                    value={editForm.invoiceDate}
                    onChange={(d) => setEditForm({ ...editForm, invoiceDate: d })}
                  />
                  <JalaliDatePicker
                    label="سررسید تسویه (شمسی)"
                    value={editForm.dueDate}
                    onChange={(d) => setEditForm({ ...editForm, dueDate: d })}
                    placeholder="اختیاری - مثال: 1404/02/15"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-cyan-400" />
                    اقلام و کالاهای فاکتور ({editForm.items.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addEditLineItem}
                      className="flex items-center gap-1 rounded-xl bg-cyan-600/20 px-3 py-1.5 font-bold text-cyan-400 hover:bg-cyan-600/30 transition border border-cyan-500/30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      افزودن کالا
                    </button>
                    <button type="button" onClick={addEditCustomLineItem} className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 font-bold text-amber-300 hover:bg-amber-950/60 transition"><Plus className="h-3.5 w-3.5" /> افزودن آیتم دستی</button>
                  </div>
                </div>

                <div className="space-y-3">
                  {editForm.items.map((item, index) => {
                    const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
                    const filteredProducts = getFilteredProducts();
                    const prod = item.productId ? filteredProducts.find((p) => p.id === item.productId) : null;

                    return (
                      <div
                        key={index}
                        className="rounded-2xl p-3 border border-slate-800 bg-slate-950 transition"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-500 text-xs">#{index + 1}</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-900/60 text-purple-300 border border-purple-700/60">
                              {item.isCustom ? "هزینه / خدمت دستی" : "کالای فاکتور شده"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => removeEditLineItem(index)}
                              className="text-rose-400 hover:text-rose-300 p-1 rounded-lg hover:bg-rose-950/50"
                              title="حذف سطر"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-4">
                            <label className="block text-[10px] text-slate-400 mb-0.5">انتخاب محصول</label>
                            {item.isCustom ? (
                              <input value={item.productName || ""} placeholder="عنوان هزینه یا خدمت" onChange={(e) => { const updated = [...editForm.items]; updated[index].productName = e.target.value; setEditForm({ ...editForm, items: updated }); }} className="w-full rounded-xl border border-amber-500/30 bg-slate-900 p-2 text-white text-xs" />
                            ) : (
                            <select
                              value={item.productId || ""}
                              onChange={(e) => handleEditProductChange(index, e.target.value)}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-white text-xs"
                            >
                              {filteredProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({formatMoney(p.effectivePrice ?? p.basePrice)}) {p.isSpecial ? "⭐" : ""}
                                </option>
                              ))}
                            </select>
                            )}
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-slate-400 mb-0.5">تعداد / مقدار</label>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => {
                                const updated = [...editForm.items];
                                updated[index].quantity = Number(e.target.value) || 0;
                                setEditForm({ ...editForm, items: updated });
                              }}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-white font-mono text-center text-xs"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[10px] text-slate-400 mb-0.5">قیمت واحد</label>
                            <MoneyInput
                              value={item.unitPrice}
                              onChange={(val) => {
                                const updated = [...editForm.items];
                                updated[index].unitPrice = val;
                                setEditForm({ ...editForm, items: updated });
                              }}
                              className="w-full text-xs py-1.5"
                              unit="تومان"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-slate-400 mb-0.5">تخفیف سطر</label>
                            <MoneyInput
                              value={item.discountAmount}
                              onChange={(val) => {
                                const updated = [...editForm.items];
                                updated[index].discountAmount = val;
                                setEditForm({ ...editForm, items: updated });
                              }}
                              className="w-full text-xs py-1.5"
                              unit="تومان"
                            />
                          </div>

                          <div className="sm:col-span-1 text-left">
                            <span className="text-[10px] text-slate-400 block">جمع سطر:</span>
                            <span className="font-mono font-bold text-white text-[11px]">{formatMoney(lineTotal)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Calculations & Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">تخفیف کلی فاکتور:</label>
                  <MoneyInput
                    value={editForm.invoiceDiscount}
                    onChange={(val) => setEditForm({ ...editForm, invoiceDiscount: val })}
                    className="w-full text-xs py-2"
                    unit="تومان"
                  />
                  <label className="block text-slate-300 font-semibold mb-1 mt-3">یادداشت و توضیحات:</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-2.5 text-white"
                  />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2 flex flex-col justify-center">
                  <div className="flex justify-between text-slate-400">
                    <span>جمع اقلام فاکتور:</span>
                    <span className="font-mono font-bold text-white">
                      {formatMoney(
                        editForm.items.reduce((acc, it) => acc + it.quantity * it.unitPrice - (it.discountAmount || 0), 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>تخفیف کل فاکتور:</span>
                    <span className="font-mono">{formatMoney(editForm.invoiceDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-cyan-400 font-bold border-t border-slate-800 pt-2 text-sm">
                    <span>مبلغ نهایی اصلاح شده:</span>
                    <span className="font-mono">
                      {formatMoney(
                        Math.max(
                          0,
                          editForm.items.reduce((acc, it) => acc + it.quantity * it.unitPrice - (it.discountAmount || 0), 0) -
                            editForm.invoiceDiscount
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingFullInvoice(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 transition"
                >
                  {saving ? "در حال ذخیره تغییرات..." : "ذخیره و اصلاح فاکتور"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
