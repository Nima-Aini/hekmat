import { NextResponse } from "next/server";
import { db } from "@/db";
import { expenses, invoices, payments, commissionLedger, customers, customerProjectMemberships } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getProjectDashboard } from "@/services/partner";

export async function GET(req:Request){
  try{
    const sp=new URL(req.url).searchParams;
    const projectId=sp.get("projectId"); const mode=sp.get("mode")||"report";
    if(!projectId) return NextResponse.json({success:false,error:"projectId الزامی است"},{status:400});
    const base=await getProjectDashboard(projectId);
    if(mode==="whatif"){
      const priceDelta=Number(sp.get("priceDelta")||0), salesDelta=Number(sp.get("salesDelta")||0), commissionDelta=Number(sp.get("commissionDelta")||0);
      const revenue=base.sales*(1+salesDelta/100)*(1+priceDelta/100);
      const commission=base.commission*(1+commissionDelta/100)*(1+salesDelta/100);
      const gross=base.grossProfit*(1+salesDelta/100)*(1+priceDelta/100);
      return NextResponse.json({success:true,mode,baseline:base,scenario:{revenue,grossProfit:gross,commission,netProfit:gross-commission,changes:{priceDelta,salesDelta,commissionDelta}}});
    }
    if(mode==="forecast"){
      const months=Math.max(1,Math.min(12,Number(sp.get("months")||3))); const monthly=base.sales/Math.max(1,new Date().getMonth()+1); return NextResponse.json({success:true,mode,forecast:{months,monthlySalesRunRate:monthly,projectedSales:monthly*months,monthlyProfitRunRate:base.grossProfit/Math.max(1,new Date().getMonth()+1),projectedGrossProfit:(base.grossProfit/Math.max(1,new Date().getMonth()+1))*months}});
    }
    if(mode==="compare"){
      const ids=(sp.get("projectIds")||"").split(",").filter(Boolean).slice(0,6); const dashboards=await Promise.all(ids.map(getProjectDashboard)); return NextResponse.json({success:true,mode,projects:dashboards});
    }
    const [{value:expense="0"}={}] = await db.select({value:sql<string>`COALESCE(SUM(${expenses.amount}),0)`}).from(expenses).where(eq(expenses.projectId,projectId));
    const [{value:receivable="0"}={}] = await db.select({value:sql<string>`COALESCE(SUM(${invoices.balanceDue}),0)`}).from(invoices).where(and(eq(invoices.projectId,projectId),eq(invoices.status,"issued")));
    const [{count:risky=0}={}] = await db.select({count:sql<number>`COUNT(*)`}).from(customers).innerJoin(customerProjectMemberships,eq(customerProjectMemberships.customerId,customers.id)).where(and(eq(customerProjectMemberships.projectId,projectId),eq(customers.healthStatus,"red")));
    return NextResponse.json({success:true,mode,report:{...base,expense:Number(expense),receivable:Number(receivable),riskyCustomers:Number(risky),netProfit:base.grossProfit-base.commission-Number(expense)}});
  }catch(e:any){return NextResponse.json({success:false,error:e.message},{status:500});}
}
