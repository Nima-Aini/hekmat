import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server"; import { getProjectDashboard } from "@/services/partner";
import { requirePermission } from "@/services/access";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission("reports.view");return NextResponse.json({success:true,dashboard:await getProjectDashboard(id)});}catch(e:any){return apiError(e);}}
