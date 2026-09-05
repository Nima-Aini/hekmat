import { apiError, assertUuid } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { projectProductPrices, products } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission('projects.view',id);const rows=await db.select({price:projectProductPrices,productName:products.name,productCode:products.code}).from(projectProductPrices).innerJoin(products,eq(projectProductPrices.productId,products.id)).where(eq(projectProductPrices.projectId,id)).orderBy(desc(projectProductPrices.updatedAt));return NextResponse.json({success:true,prices:rows});}catch(e){return apiError(e);}}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission('projects.price.manage',id);const b=await req.json();if(!b.productId||b.customPrice==null)return NextResponse.json({success:false,error:'محصول و قیمت الزامی است'},{status:400});const [row]=await db.insert(projectProductPrices).values({projectId:id,productId:b.productId,customPrice:String(b.customPrice),overrideCommissionRate:b.overrideCommissionRate!=null?String(b.overrideCommissionRate):null}).onConflictDoUpdate({target:[projectProductPrices.projectId,projectProductPrices.productId],set:{customPrice:String(b.customPrice),overrideCommissionRate:b.overrideCommissionRate!=null?String(b.overrideCommissionRate):null,updatedAt:new Date()}}).returning();await logAuditEvent('PRICE_CHANGE','project',id,{productId:b.productId,customPrice:b.customPrice,overrideCommissionRate:b.overrideCommissionRate??null});return NextResponse.json({success:true,price:row});}catch(e){return apiError(e);}}
