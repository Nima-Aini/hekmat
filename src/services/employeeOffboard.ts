import { db } from "@/db";
import { employees, employeeAccounts, customers, customerAssignments, tasks, invoices, commissionLedger, consignments } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { logAuditEvent } from "./audit";
export interface OffboardEmployeeInput { employeeId:string; replacementEmployeeId?:string|null; transferReason?:string; }
export async function getOffboardingOpenItems(employeeId:string){
 const [assignedCustomers,openTasks,openInvoices,unpaidCommission,openConsignments]=await Promise.all([
  db.select({id:customers.id,name:customers.name}).from(customers).where(eq(customers.assignedEmployeeId,employeeId)),
  db.select({id:tasks.id,title:tasks.title,status:tasks.status,dueDate:tasks.dueDate}).from(tasks).where(and(eq(tasks.assignedEmployeeId,employeeId),inArray(tasks.status,['open','in_progress','overdue']))),
  db.select({id:invoices.id,invoiceNumber:invoices.invoiceNumber,balanceDue:invoices.balanceDue,status:invoices.status}).from(invoices).where(and(eq(invoices.employeeId,employeeId),inArray(invoices.status,['issued','corrected']),inArray(invoices.paymentStatus,['unpaid','partial','overdue']))),
  db.select({id:commissionLedger.id,commissionAmount:commissionLedger.commissionAmount,status:commissionLedger.status}).from(commissionLedger).where(and(eq(commissionLedger.employeeId,employeeId),inArray(commissionLedger.status,['pending','calculated','payable']))),
  db.select({id:consignments.id,consignmentNumber:consignments.consignmentNumber,status:consignments.status}).from(consignments).where(and(eq(consignments.employeeId,employeeId),inArray(consignments.status,['delivered','partially_sold'])))
 ]);
 return {customers:assignedCustomers,tasks:openTasks,invoices:openInvoices,commissions:unpaidCommission,consignments:openConsignments};
}
export async function offboardEmployee(input:OffboardEmployeeInput){
 const [emp]=await db.select().from(employees).where(eq(employees.id,input.employeeId)).limit(1); if(!emp)throw new Error('کارمند/همکار یافت نشد'); if(input.replacementEmployeeId===input.employeeId)throw new Error('همکار نمی‌تواند جایگزین خودش باشد');
 let replacementName='بدون مسئول جدید'; if(input.replacementEmployeeId){const [replacement]=await db.select().from(employees).where(eq(employees.id,input.replacementEmployeeId)).limit(1);if(!replacement||replacement.status!=='active')throw new Error('همکار جایگزین معتبر و فعال نیست');replacementName=replacement.name;}
 const open=await getOffboardingOpenItems(input.employeeId);
 const [updatedEmp]=await db.transaction(async(tx:any)=>{
   const assigned=await tx.select({id:customers.id}).from(customers).where(eq(customers.assignedEmployeeId,input.employeeId));
   for(const c of assigned){await tx.update(customerAssignments).set({endedAt:new Date(),status:'ended'}).where(and(eq(customerAssignments.customerId,c.id),eq(customerAssignments.status,'active')));if(input.replacementEmployeeId)await tx.insert(customerAssignments).values({customerId:c.id,employeeId:input.replacementEmployeeId,assignedAt:new Date(),assignedBy:'offboarding',assignmentReason:input.transferReason||'انتقال هنگام قطع همکاری',status:'active'});}
   await tx.update(customers).set({assignedEmployeeId:input.replacementEmployeeId||null,updatedAt:new Date()}).where(eq(customers.assignedEmployeeId,input.employeeId));
   await tx.update(tasks).set({assignedEmployeeId:input.replacementEmployeeId||null,updatedAt:new Date()}).where(and(eq(tasks.assignedEmployeeId,input.employeeId),inArray(tasks.status,['open','in_progress','overdue'])));
   if(input.replacementEmployeeId)await tx.update(consignments).set({employeeId:input.replacementEmployeeId}).where(and(eq(consignments.employeeId,input.employeeId),inArray(consignments.status,['delivered','partially_sold'])));
   await tx.update(employeeAccounts).set({status:'suspended',updatedAt:new Date()}).where(eq(employeeAccounts.employeeId,input.employeeId));
   return tx.update(employees).set({status:'transferred',offboardingStage:'offboarding_complete',notes:`خروج/انتقال مسئولیت‌ها به ${replacementName}. علت: ${input.transferReason||'انتقال سازمانی'}. ${emp.notes||''}`,updatedAt:new Date()}).where(eq(employees.id,input.employeeId)).returning();
 });
 await logAuditEvent('OFFBOARD','employee',input.employeeId,{before:emp,after:updatedEmp,openItems:open,replacementEmployeeId:input.replacementEmployeeId||null,replacementName,reason:input.transferReason});
 return {employee:updatedEmp,transferredCustomersCount:open.customers.length,openTasksCount:open.tasks.length,openInvoicesCount:open.invoices.length,unpaidCommissionCount:open.commissions.length,openConsignmentsCount:open.consignments.length,replacementName,stage:'offboarding_complete'};
}
