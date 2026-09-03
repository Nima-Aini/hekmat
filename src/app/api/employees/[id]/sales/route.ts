import { NextResponse } from "next/server"; import { db } from "@/db"; import { invoices } from "@/db/schema"; import { desc, eq } from "drizzle-orm";
import { requirePermission } from "@/services/access";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;await requirePermission("invoices.view");const sales=await db.select().from(invoices).where(eq(invoices.employeeId,id)).orderBy(desc(invoices.invoiceDate));return NextResponse.json({success:true,sales});}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:500});}}
