import { NextResponse } from "next/server";
import { requirePermission } from "@/services/access";
import { transferCustomers } from "@/services/partner";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;await requirePermission("customers.transfer");const b=await req.json();const result=await transferCustomers([id],b.toEmployeeId||null,b.projectId||null,b.reason||"انتقال مشتری",b.assignedBy||"system");return NextResponse.json({success:true,result});}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:500});}}
