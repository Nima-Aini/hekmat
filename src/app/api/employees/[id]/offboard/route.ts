import { NextResponse } from "next/server";
import { getOffboardingOpenItems, offboardEmployee } from "@/services/employeeOffboard";
import { requirePermission } from "@/services/access";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;await requirePermission('employees.manage');return NextResponse.json({success:true,openItems:await getOffboardingOpenItems(id)});}catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:'خطا'},{status:403});}}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;await requirePermission('employees.manage');const b=await req.json();const result=await offboardEmployee({employeeId:id,replacementEmployeeId:b.replacementEmployeeId||null,transferReason:b.transferReason});return NextResponse.json({success:true,result});}catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:'خطا'},{status:403});}}
