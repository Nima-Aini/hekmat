import { apiError, assertUuid } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { getOffboardingOpenItems, offboardEmployee } from "@/services/employeeOffboard";
import { requirePermission } from "@/services/access";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission('employees.manage');return NextResponse.json({success:true,openItems:await getOffboardingOpenItems(id)});}catch(e){return apiError(e);}}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission('employees.manage');const b=await req.json();const result=await offboardEmployee({employeeId:id,replacementEmployeeId:b.replacementEmployeeId||null,transferReason:b.transferReason});return NextResponse.json({success:true,result});}catch(e){return apiError(e);}}
