import { ApiError } from "@/lib/apiError";
import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { requirePermission } from "@/services/access";
import { getEmployeeDashboard } from "@/services/partner";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) { try {
    const viewer = await requirePermission("employees.view"); const {id}=await params;
    assertUuid(id); if (!viewer.permissions.has("*") && !viewer.permissions.has("employees.manage") && viewer.employeeId !== id) throw new ApiError(403, "دسترسی به اطلاعات همکار دیگر مجاز نیست."); const period=new URL(req.url).searchParams.get("period")||"month"; return NextResponse.json({success:true,dashboard:await getEmployeeDashboard(id,period)});} catch(e:any){return apiError(e);}}
