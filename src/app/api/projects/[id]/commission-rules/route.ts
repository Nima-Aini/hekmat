import { apiError, assertUuid } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { commissionRules } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission('commissions.view',id);return NextResponse.json({success:true,rules:await db.select().from(commissionRules).where(eq(commissionRules.projectId,id)).orderBy(desc(commissionRules.createdAt))});}catch(e){return apiError(e);}}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission('projects.commission.manage',id);const b=await req.json();if(!b.name||b.rateValue==null)return NextResponse.json({success:false,error:'نام و مقدار Rule الزامی است'},{status:400});const [row]=await db.insert(commissionRules).values({name:b.name,projectId:id,productId:b.productId||null,employeeId:b.employeeId||null,ruleType:b.ruleType||'percentage',rateValue:String(b.rateValue),effectiveStartDate:b.effectiveStartDate?new Date(b.effectiveStartDate):new Date(),effectiveEndDate:b.effectiveEndDate?new Date(b.effectiveEndDate):null,isActive:b.isActive!==false}).returning();await logAuditEvent('COMMISSION_CHANGE','project',id,{rule:row});return NextResponse.json({success:true,rule:row});}catch(e){return apiError(e);}}
