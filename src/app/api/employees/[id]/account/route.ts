import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { requirePermission } from "@/services/access";
import { db } from "@/db"; import { employees } from "@/db/schema"; import { eq } from "drizzle-orm"; import { setupEmployeeAccount } from "@/services/partner";
import { hashPassword } from "@/services/employeeAuth";
import { logAuditEvent } from "@/services/audit";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);const context=await requirePermission("employees.manage");const body=await req.json();if(!body.username||!body.password)return NextResponse.json({success:false,error:"نام کاربری و رمز عبور الزامی است."},{status:400});const[e]=await db.select().from(employees).where(eq(employees.id,id)).limit(1);if(!e)return NextResponse.json({success:false,error:"همکار پیدا نشد"},{status:404});const account=await setupEmployeeAccount(id,body.username,hashPassword(body.password),body.roleCode||"sales");await logAuditEvent("EMPLOYEE_ACCOUNT_SETUP","employee_account",account.id,{employeeId:id,username:account.username,roleCode:body.roleCode||"sales"},{userId:context.employeeId,userName:context.roleCode});return NextResponse.json({success:true,account:{id:account.id,username:account.username,status:account.status,roleId:account.roleId}});}catch(e:any){return apiError(e);}}
