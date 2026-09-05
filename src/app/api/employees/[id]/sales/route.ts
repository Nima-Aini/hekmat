import { assertUuid } from "@/lib/apiError";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server"; import { db } from "@/db"; import { invoices } from "@/db/schema"; import { desc, eq } from "drizzle-orm";
import { requirePermission } from "@/services/access";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;
    assertUuid(id);await requirePermission("invoices.view");const sales=await db.select().from(invoices).where(eq(invoices.employeeId,id)).orderBy(desc(invoices.invoiceDate));return NextResponse.json({success:true,sales});}catch(e:any){return apiError(e);}}
