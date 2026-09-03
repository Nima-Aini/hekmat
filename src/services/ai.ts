import { GoogleGenAI } from "@google/genai";
import { getDashboardKPIs } from "./reporting";
import { getActiveAlerts } from "./alerts";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectDashboard } from "@/services/partner";
import { AIActionPayload, executeAIAction } from "./aiDataModifier";

export interface AIAnalysisResult {
  answer: string;
  facts: string[];
  calculatedMetrics: Record<string, any>;
  assumptions: string[];
  recommendations: string[];
  proposalAction?: {
    actionType: string;
    description: string;
    payload: Record<string, any>;
    requiresUserApproval: boolean;
  } | null;
}

export interface ChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
  actionProposal?: AIActionPayload | null;
}

// Approved Gemini models from gemini-api skill with fallback order for free-tier resilience
const CANDIDATE_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.7-flash",
  "gemini-flash-latest",
];

async function getGeminiApiKey(): Promise<string> {
  const [settings] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.id, "main_config"))
    .limit(1);

  const key = process.env.GEMINI_API_KEY || settings?.openaiApiKey;
  if (!key) {
    throw new Error(
      "کلید Gemini تنظیم نشده است. لطفاً مقدار GEMINI_API_KEY را در Environment Variables یا تنظیمات وارد نمایید."
    );
  }
  return key;
}

function parseGeminiJson(text: string): Record<string, any> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // If JSON parsing fails, return null
  }
  return { answer: text, facts: [], recommendations: [], assumptions: [] };
}

/**
 * Deep Business Analysis Query
 */
export async function queryAIAssistant(
  question: string,
  projectId?: string | null
): Promise<AIAnalysisResult> {
  const apiKey = await getGeminiApiKey();
  const kpis = await getDashboardKPIs({ projectId });
  const activeAlerts = await getActiveAlerts(projectId);
  const projectContext = projectId ? await getProjectDashboard(projectId) : null;

  const facts = [
    `مبلغ کل فروش: ${kpis.totalSales.toLocaleString("fa-IR")} تومان`,
    `سود ناخالص عملیاتی: ${kpis.totalGrossProfit.toLocaleString("fa-IR")} تومان (حاشیه سود ناخالص: ${kpis.grossMarginPercent}%)`,
    `سود خالص کسب‌وکار: ${kpis.netProfit.toLocaleString("fa-IR")} تومان (حاشیه سود خالص: ${kpis.netMarginPercent}%)`,
    `مجموع مطالبات (دریافتنی): ${kpis.totalReceivable.toLocaleString("fa-IR")} تومان`,
    `موجودی نقدینگی و بانک: ${kpis.totalLiquidity.toLocaleString("fa-IR")} تومان`,
    `تعداد اعلان‌های فعال سیستم: ${activeAlerts.length} عدد`,
  ];

  const calculatedMetrics = {
    totalSales: kpis.totalSales,
    totalGrossProfit: kpis.totalGrossProfit,
    grossMarginPercent: kpis.grossMarginPercent,
    netProfit: kpis.netProfit,
    netMarginPercent: kpis.netMarginPercent,
    totalReceivable: kpis.totalReceivable,
    totalLiquidity: kpis.totalLiquidity,
    healthBreakdown: kpis.healthBreakdown,
  };

  const assumptions = [
    "تحلیل بر اساس داده‌های ثبت شده عملیاتی تا زمان حاضر انجام گرفته است.",
    "نرخ‌های بهای تمام شده بر اساس فرمول ساخت BOM و قیمت‌های خرید جاری محاسبه شده‌اند.",
  ];

  const systemInstruction = `شما مشاور ارشد و تحلیل‌گر هوشمند کسب‌وکار سیستم «حکمت آکما» هستید.
پاسخ‌های شما باید کاربردی، دقیق، واقع‌بینانه و به زبان فارسی روان باشند.
پاسخ را در قالب یک آبجکت JSON معتبر شامل کلیدهای زیر بازگردانید:
{
  "answer": "پاسخ کامل، تحلیلی و راهنمای تفصیلی به سوال کاربر",
  "facts": ["فهرستی از حقایق کلیدی مستخرج از داده‌های دیتابیس"],
  "recommendations": ["راهکارهای عملیاتی و راهبردی بهبود سود یا مدیریت"],
  "assumptions": ["فرضیات مورد استفاده در تحلیل"],
  "proposalAction": null
}`;

  const userPrompt = `پرسش یا موضوع تحلیل:
${question.trim()}

داده‌های واقعی مالی و عملیاتی فعلی سیستم:
${facts.join("\n")}

شاخص‌های دقیق سیستم:
${JSON.stringify(calculatedMetrics)}

اطلاعات پروژه منتخب:
${JSON.stringify(projectContext)}

اعلان‌های مهم اخیر:
${JSON.stringify(activeAlerts.slice(0, 10))}`;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  let lastError = "";

  for (const model of CANDIDATE_GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text;
      if (responseText) {
        const content = parseGeminiJson(responseText);
        return {
          answer: typeof content.answer === "string" ? content.answer : responseText,
          facts: Array.isArray(content.facts) && content.facts.length ? content.facts : facts,
          calculatedMetrics,
          assumptions: Array.isArray(content.assumptions) && content.assumptions.length ? content.assumptions : assumptions,
          recommendations: Array.isArray(content.recommendations) ? content.recommendations : [],
          proposalAction: content.proposalAction && typeof content.proposalAction === "object" ? content.proposalAction : null,
        };
      }
    } catch (err: any) {
      lastError = `Model ${model}: ${err.message || String(err)}`;
      console.warn(`Gemini fallback from ${model}:`, err.message);
    }
  }

  throw new Error(`خطا در ارتباط با هوش مصنوعی جمنای. آخرین پیغام: ${lastError}`);
}

/**
 * Direct Interactive Conversational Chat with AI with Data Modification Capability
 */
export async function chatWithAI(
  messages: ChatMessage[],
  projectId?: string | null
): Promise<{ reply: string; modelUsed: string; actionProposal?: AIActionPayload | null }> {
  const apiKey = await getGeminiApiKey();
  const kpis = await getDashboardKPIs({ projectId });
  const activeAlerts = await getActiveAlerts(projectId);

  const contextSummary = `شما دستیار هوش مصنوعی هوشمند سیستم مدیریت، تولید و حسابداری حکمت آکما هستید.
شما علاوه بر پاسخگویی به سوالات، توانایی اعمال تغییرات در اطلاعات سیستم (Data Modification) را دارید.

عملیات‌های قابل انجام توسط شما در دیتابیس سیستم:
1. "APPLY_INFLATION_PRODUCTS": تغییر قیمت فروش محصولات بر اساس درصد تورم یا درصد اعلامی (پارامتر: percent مثلاً 10 یا -5). مثال: "تورم 10 درصد داشتیم روی محصولات اعمال کن".
2. "APPLY_INFLATION_RAW_MATERIALS": تغییر هزینه خرید مواد اولیه بر اساس درصد تورم (پارامتر: percent).
3. "UPDATE_VISITOR_COMMISSIONS": تغییر درصد پورسانت ویزیتورها (پارامتر: percent و در صورت درخواست commissionBase با مقادیر "sales_total" یا "net_profit").
4. "CREATE_PRODUCT": ایجاد محصول جدید (پارامترها: name, basePrice, category).
5. "CREATE_CUSTOMER": ثبت مشتری جدید (پارامترها: name, mobile, city, storeName).

اطلاعات زنده سیستم:
- فروش کل: ${kpis.totalSales.toLocaleString("fa-IR")} تومان
- حاشیه سود خالص: ${kpis.netMarginPercent}%
- مطالبات کل: ${kpis.totalReceivable.toLocaleString("fa-IR")} تومان
- نقدینگی و بانک: ${kpis.totalLiquidity.toLocaleString("fa-IR")} تومان
- تعداد اعلانات فعال: ${activeAlerts.length}

قالب پاسخ دهی شما:
پاسخ را همواره در ساختار JSON استاندارد زیر تولید کنید:
{
  "reply": "متن پاسخ فارسی محترمانه و دقیق به کاربر",
  "actionProposal": null | {
    "actionType": "APPLY_INFLATION_PRODUCTS" | "APPLY_INFLATION_RAW_MATERIALS" | "UPDATE_VISITOR_COMMISSIONS" | "CREATE_PRODUCT" | "CREATE_CUSTOMER",
    "description": "توضیح کوتاه عملیاتی که انجام خواهد شد",
    "parameters": { "percent": 10, ... }
  }
}
اگر کاربر از شما خواست تغییری در سیستم یا قیمت‌ها یا تورم ایجاد کنید، حتماً actionProposal را با پارامترهای استخراج شده تکمیل کنید.`;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const lastUserMsg = messages[messages.length - 1]?.content || "سلام";
  const conversationHistory = messages
    .slice(0, -1)
    .map((m) => `${m.role === "user" ? "کاربر" : "هوش مصنوعی"}: ${m.content}`)
    .join("\n");
  const fullPrompt = `${conversationHistory ? `تاریخچه گفتگو:\n${conversationHistory}\n\n` : ""}پیام کاربر: ${lastUserMsg}`;

  let lastError = "";

  for (const model of CANDIDATE_GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: fullPrompt,
        config: {
          systemInstruction: contextSummary,
          responseMimeType: "application/json",
        },
      });

      if (response.text) {
        const parsed = parseGeminiJson(response.text);
        const reply = parsed.reply || (typeof parsed.answer === "string" ? parsed.answer : response.text);
        const actionProposal = parsed.actionProposal || null;

        return {
          reply,
          modelUsed: model,
          actionProposal,
        };
      }
    } catch (err: any) {
      lastError = `Model ${model}: ${err.message || String(err)}`;
      console.warn(`Chat Gemini fallback from ${model}:`, err.message);
    }
  }

  throw new Error(`پاسخی از هوش مصنوعی دریافت نشد. خطا: ${lastError}`);
}
