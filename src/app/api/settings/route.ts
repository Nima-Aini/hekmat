import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/services/audit";
import { requirePermission } from "@/services/access";

export async function GET(req: Request) {
  try {
    await requirePermission("admin.settings");
    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "main_config")).limit(1);

    const safeSettings = settings
      ? {
          ...settings,
          openaiApiKey: settings.openaiApiKey ? "••••••••" : "",
          neshanApiKey: settings.neshanApiKey ? "••••••••" : "",
        }
      : {
          businessName: "سازمان و کسب‌وکار حکمت آکما",
          economicCode: "",
          nationalId: "",
          registrationNumber: "",
          postalCode: "",
          companyAddress: "",
          companyPhone: "",
          taxOffice: "",
          taxRateCorporate: 25,
          vatRate: 10,
          currency: "تومان",
          aiEnabled: true,
          mapProvider: "neshan",
          neshanApiKey: "",
        };

    return NextResponse.json({ success: true, settings: safeSettings });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return apiError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requirePermission("admin.settings");
    const body = await req.json();

    if (body.taxRateCorporate !== undefined) {
      const rate = Number(body.taxRateCorporate);
      if (rate < 0 || rate > 100 || !isFinite(rate)) {
        return NextResponse.json({ success: false, error: "نرخ مالیات شرکت نامعتبر است." }, { status: 400 });
      }
    }
    if (body.vatRate !== undefined) {
      const rate = Number(body.vatRate);
      if (rate < 0 || rate > 100 || !isFinite(rate)) {
        return NextResponse.json({ success: false, error: "نرخ مالیات ارزش افزوده نامعتبر است." }, { status: 400 });
      }
    }

    const updateData: Record<string, any> = {
      id: "main_config",
      businessName: body.businessName,
      taxNumber: body.taxNumber || body.economicCode,
      economicCode: body.economicCode || body.taxNumber,
      nationalId: body.nationalId,
      registrationNumber: body.registrationNumber,
      postalCode: body.postalCode,
      companyAddress: body.companyAddress,
      companyPhone: body.companyPhone,
      taxOffice: body.taxOffice,
      taxRateCorporate: body.taxRateCorporate !== undefined ? Number(body.taxRateCorporate) : 25,
      vatRate: body.vatRate !== undefined ? Number(body.vatRate) : 10,
      currency: body.currency || "تومان",
      healthGreenThreshold: body.healthGreenThreshold ? Number(body.healthGreenThreshold) : 75,
      healthYellowThreshold: body.healthYellowThreshold ? Number(body.healthYellowThreshold) : 50,
      openaiModel: body.openaiModel || "gemini-2.5-flash",
      aiEnabled: body.aiEnabled !== undefined ? body.aiEnabled : true,
      mapProvider: body.mapProvider || "neshan",
      updatedAt: new Date(),
    };

    if (body.openaiApiKey !== undefined && body.openaiApiKey !== "••••••••" && body.openaiApiKey !== "") {
      updateData.openaiApiKey = body.openaiApiKey;
    }
    if (body.neshanApiKey !== undefined && body.neshanApiKey !== "••••••••" && body.neshanApiKey !== "") {
      updateData.neshanApiKey = body.neshanApiKey;
    }

    const [updated] = await db
      .insert(systemSettings)
      .values(updateData)
      .onConflictDoUpdate({
        target: systemSettings.id,
        set: updateData,
      })
      .returning();

    await logAuditEvent("UPDATE", "settings", "main_config", {
      businessName: updated.businessName,
    }, { userId: context.employeeId, userName: context.roleCode });

    const safeResponse = {
      ...updated,
      openaiApiKey: updated.openaiApiKey ? "••••••••" : "",
      neshanApiKey: updated.neshanApiKey ? "••••••••" : "",
    };
    return NextResponse.json({ success: true, settings: safeResponse });
  } catch (error: any) {
    const status = error.message?.includes("دسترسی") ? 403 : 500;
    return apiError(error);
  }
}
