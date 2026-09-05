import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server"; import { transferCustomers } from "@/services/partner";
import { requirePermission } from "@/services/access";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission("customers.transfer");const body=await req.json();const ids=Array.isArray(body.customerIds)?body.customerIds:[];const result=await transferCustomers(ids,body.toEmployeeId||null,body.projectId||null,body.reason||`انتقال از همکار ${id}`,body.assignedBy||"admin");return NextResponse.json({success:true,result});}catch(e:any){return apiError(e);}}
