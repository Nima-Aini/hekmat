import { NextResponse } from "next/server";
import {
  getDashboardKPIs,
  getSalesReport,
  getFinancialProfitReport,
  getCashFlowReport,
  getInventoryAndRawMaterialReport,
  getProjectComparisonReport,
  getTaxDeclarationReport
} from "@/services/reporting";
import { simulateInflationImpact } from "@/services/pricing";
import { requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "dashboard";
    const projectId = searchParams.get("projectId");
    await requirePermission("reports.view", projectId);

    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const customerId = searchParams.get("customerId");
    const employeeId = searchParams.get("employeeId");

    let parsedStartDate: Date | null = null;
    let parsedEndDate: Date | null = null;

    if (startDateStr) {
      parsedStartDate = new Date(startDateStr);
      if (startDateStr.length <= 10 && !isNaN(parsedStartDate.getTime())) {
        parsedStartDate.setHours(0, 0, 0, 0);
      }
    }

    if (endDateStr) {
      parsedEndDate = new Date(endDateStr);
      if (endDateStr.length <= 10 && !isNaN(parsedEndDate.getTime())) {
        parsedEndDate.setHours(23, 59, 59, 999);
      }
    }

    const filter = {
      projectId: projectId || null,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      customerId: customerId || null,
      employeeId: employeeId || null,
    };

    if (type === "dashboard") {
      const data = await getDashboardKPIs(filter);
      return NextResponse.json({ success: true, data });
    }

    if (type === "sales") {
      const data = await getSalesReport(filter);
      return NextResponse.json({ success: true, data });
    }

    if (type === "financial") {
      const data = await getFinancialProfitReport(filter);
      return NextResponse.json({ success: true, data });
    }

    if (type === "tax_declaration") {
      const data = await getTaxDeclarationReport(filter);
      return NextResponse.json({ success: true, data });
    }

    if (type === "cashflow") {
      const data = await getCashFlowReport(filter);
      return NextResponse.json({ success: true, data });
    }

    if (type === "inventory") {
      const data = await getInventoryAndRawMaterialReport(filter);
      return NextResponse.json({ success: true, data });
    }

    if (type === "project_comparison") {
      const projA = searchParams.get("projectAId");
      const projB = searchParams.get("projectBId");
      if (!projA || !projB) {
        return NextResponse.json({ success: false, error: "انتخاب دو پروژه برای مقایسه الزامی است." }, { status: 400 });
      }
      const data = await getProjectComparisonReport(projA, projB, filter);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: "نوع گزارش نامعتبر است." }, { status: 400 });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requirePermission("reports.simulate");
    const body = await req.json();

    if (body.action === "simulate_inflation") {
      const simulation = await simulateInflationImpact(body.changes || {});
      return NextResponse.json({ success: true, simulation });
    }

    return NextResponse.json({ success: false, error: "عملیات نامعتبر" }, { status: 400 });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
