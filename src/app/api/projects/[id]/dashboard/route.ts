import { NextResponse } from "next/server"; import { getProjectDashboard } from "@/services/partner";
import { requirePermission } from "@/services/access";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;await requirePermission("reports.view");return NextResponse.json({success:true,dashboard:await getProjectDashboard(id)});}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:500});}}
