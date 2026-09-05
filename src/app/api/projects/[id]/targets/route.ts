import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server"; import { db } from "@/db"; import { projectTargets } from "@/db/schema"; import { desc, eq } from "drizzle-orm";
import { requirePermission } from "@/services/access";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission("reports.view",id);return NextResponse.json({success:true,targets:await db.select().from(projectTargets).where(eq(projectTargets.projectId,id)).orderBy(desc(projectTargets.periodStart))});}catch(e:any){return apiError(e);}}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission("projects.update",id);const b=await req.json();const [target]=await db.insert(projectTargets).values({projectId:id,periodStart:new Date(b.periodStart),periodEnd:new Date(b.periodEnd),salesTarget:String(b.salesTarget||0),customerTarget:Number(b.customerTarget||0),profitTarget:String(b.profitTarget||0),collectionTarget:String(b.collectionTarget||0)}).returning();return NextResponse.json({success:true,target});}catch(e:any){return apiError(e);}}
