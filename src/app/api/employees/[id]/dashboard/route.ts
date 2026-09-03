import { NextResponse } from "next/server";
import { requirePermission } from "@/services/access";
import { getEmployeeDashboard } from "@/services/partner";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) { try { const {id}=await params; const period=new URL(req.url).searchParams.get("period")||"month"; return NextResponse.json({success:true,dashboard:await getEmployeeDashboard(id,period)});} catch(e:any){return NextResponse.json({success:false,error:e.message},{status:500});}}
