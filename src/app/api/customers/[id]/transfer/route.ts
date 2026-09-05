import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { requirePermission } from "@/services/access";
import { transferCustomers } from "@/services/partner";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission("customers.transfer");const b=await req.json();const result=await transferCustomers([id],b.toEmployeeId||null,b.projectId||null,b.reason||"انتقال مشتری",b.assignedBy||"system");return NextResponse.json({success:true,result});}catch(e:any){return apiError(e);}}
