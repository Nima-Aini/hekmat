import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server"; import { getEmployeeDashboard } from "@/services/partner";
import { requirePermission } from "@/services/access";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission("reports.view");const [today,week,month,year]=await Promise.all([getEmployeeDashboard(id,"today"),getEmployeeDashboard(id,"week"),getEmployeeDashboard(id,"month"),getEmployeeDashboard(id,"year")]);return NextResponse.json({success:true,reports:{today,week,month,year}});}catch(e:any){return apiError(e);}}
