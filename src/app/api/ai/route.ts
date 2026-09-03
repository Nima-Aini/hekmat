import { NextResponse } from "next/server";
import { requirePermission } from "@/services/access";
import { queryAIAssistant, chatWithAI } from "@/services/ai";
import { executeAIAction } from "@/services/aiDataModifier";

export async function POST(req: Request) {
  try {
    await requirePermission("ai.view");
    const body = await req.json();

    if (body.action === "execute_action") {
      await requirePermission("admin.settings");
      if (!body.actionProposal) {
        return NextResponse.json({ success: false, error: "اطلاعات عملیات هوش مصنوعی مشخص نیست." }, { status: 400 });
      }
      const executionResult = await executeAIAction(body.actionProposal);
      return NextResponse.json({ ...executionResult });
    }

    if (body.action === "chat") {
      if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        return NextResponse.json({ success: false, error: "لیست پیام‌های گفتگو الزامی است." }, { status: 400 });
      }
      const chatRes = await chatWithAI(body.messages, body.projectId);
      return NextResponse.json({ success: true, ...chatRes });
    }

    // Default: Analysis / Question
    if (!body.question) {
      return NextResponse.json({ success: false, error: "متن سوال الزامی است." }, { status: 400 });
    }

    const result = await queryAIAssistant(body.question, body.projectId);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
