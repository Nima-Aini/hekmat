"use client";

import React, { useState, useRef, useEffect } from "react";
import { NeonBadge } from "@/components/ui/NeonBadge";
import {
  Bot,
  Send,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  BarChart3,
  User,
  Zap,
  Trash2,
  CheckCircle2,
  Play,
  TrendingUp,
} from "lucide-react";

interface AiAssistantViewProps {
  selectedProjectId: string | null;
}

interface ChatMsg {
  role: "user" | "model" | "assistant";
  content: string;
  timestamp?: string;
  modelUsed?: string;
  actionProposal?: {
    actionType: string;
    description: string;
    parameters: Record<string, any>;
  } | null;
  actionExecuted?: boolean;
  executionResultText?: string;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({ selectedProjectId }) => {
  const [activeMode, setActiveMode] = useState<"chat" | "analysis">("chat");

  // Chat State
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "model",
      content:
        "سلام! من دستیار هوش مصنوعی حکمت آکما هستم. می‌توانید علاوه بر تحلیل و سوالات مالی، دستور تغییر اطلاعات سایت را نیز بدهید؛ مثلاً: «تورم ۱۰ درصد داشتیم، اعمال کن روی قیمت محصولات» یا «پورسانت ویزیتورها را به ۶ درصد بر اساس سود خالص تغییر بده».",
      timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [executingActionIdx, setExecutingActionIdx] = useState<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Analysis State
  const [analysisQuestion, setAnalysisQuestion] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  useEffect(() => {
    if (activeMode === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeMode]);

  const handleSendChat = async (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim() || chatLoading) return;

    const userMsg: ChatMsg = {
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          messages: newHistory.map((m) => ({
            role: m.role === "assistant" ? "model" : m.role,
            content: m.content,
          })),
          projectId: selectedProjectId,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            content: res.reply,
            modelUsed: res.modelUsed,
            actionProposal: res.actionProposal || null,
            timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            content: `⚠️ خطا: ${res.error || "پاسخی از هوش مصنوعی دریافت نشد."}`,
            timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: `⚠️ خطای ارتباط با سرور: ${err.message || "لطفاً اتصال اینترنت خود را بررسی کنید."}`,
          timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleExecuteActionProposal = async (msgIndex: number, actionProposal: any) => {
    setExecutingActionIdx(msgIndex);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute_action",
          actionProposal,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setMessages((prev) =>
          prev.map((m, idx) =>
            idx === msgIndex
              ? {
                  ...m,
                  actionExecuted: true,
                  executionResultText: res.message || "عملیات با موفقیت در دیتابیس اعمال گردید.",
                }
              : m
          )
        );
      } else {
        alert(res.error || "خطا در اعمال عملیات");
      }
    } catch (err: any) {
      alert(err.message || "خطا در ارتباط با سرور");
    } finally {
      setExecutingActionIdx(null);
    }
  };

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysisQuestion.trim() || analysisLoading) return;

    setAnalysisLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analysis",
          question: analysisQuestion,
          projectId: selectedProjectId,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setAnalysisResult(res.result);
      } else {
        alert(res.error || "خطا در پردازش تحلیل");
      }
    } catch (err: any) {
      alert(err.message || "خطا در ارتباط با سرور");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const samplePrompts = [
    "تورم ۱۰ درصد داشتیم، اعمال کن روی قیمت محصولات",
    "هزینه خرید مواد اولیه را ۸ درصد افزایش بده به علت تورم",
    "پورسانت ویزیتورها را به ۶ درصد بر اساس سود خالص تنظیم کن",
    "وضعیت نقدینگی و مطالبات دریافتنی کسب‌وکار چطور است؟",
    "کدام مشتریان بدهی معوق دارند و راهکار پیگیری چیست؟",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-l from-purple-950/70 via-violet-950/45 to-slate-900/60 p-4 shadow-xl shadow-purple-950/20 sm:flex sm:items-center sm:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 h-36 w-36 rounded-full bg-purple-500/15 blur-3xl motion-safe:animate-pulse" />
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/15 shadow-lg shadow-purple-500/20">
              <Bot className="h-6 w-6 text-purple-300" />
            </span>
            مرکز هوش مصنوعی حکمت آکما (Gemini AI Core)
          </h2>
          <p className="mr-12 text-xs text-purple-100/70 mt-1">
            دستیار هوشمند با قابلیت چت زنده، تحلیل داده‌ها و تغییر مستقیم اطلاعات و نرخ‌ها در سیستم
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="relative mt-4 flex items-center gap-1.5 rounded-xl border border-purple-500/25 bg-slate-950/70 p-1 sm:mt-0">
          <button
            onClick={() => setActiveMode("chat")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeMode === "chat"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            چت و اعمال دستورات در دیتابیس
          </button>
          <button
            onClick={() => setActiveMode("analysis")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeMode === "analysis"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            تحلیل استراتژیک و KPI
          </button>
        </div>
      </div>

      {/* CHAT MODE */}
      {activeMode === "chat" && (
        <div className="flex flex-col h-[650px] rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Chat Top bar */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-white">اتصال زنده هوش مصنوعی Gemini</span>
              <span className="text-[10px] text-emerald-400 font-mono">قابلیت خواندن و تغییر زنده اطلاعات</span>
            </div>
            <button
              onClick={() =>
                setMessages([
                  {
                    role: "model",
                    content: "گفتگوی جدید آغاز شد. چه دستوری دارید؟",
                    timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
                  },
                ])
              }
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              پاکسازی گفتگو
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div key={i} className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                      isUser
                        ? "bg-blue-600 text-white"
                        : "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                    }`}
                  >
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-6 space-y-2 shadow-sm ${
                      isUser
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : "bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Action Proposal Interactive Card */}
                    {msg.actionProposal && (
                      <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-3 text-xs space-y-2.5">
                        <div className="flex items-center gap-2 text-amber-300 font-bold">
                          <TrendingUp className="h-4 w-4" />
                          <span>پیشنهاد اعمال تغییر در دیتابیس سیستم:</span>
                        </div>
                        <p className="text-slate-300">{msg.actionProposal.description}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>عملیات: {msg.actionProposal.actionType}</span>
                          <span>|</span>
                          <span>پارامترها: {JSON.stringify(msg.actionProposal.parameters)}</span>
                        </div>

                        {msg.actionExecuted ? (
                          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-bold">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{msg.executionResultText || "با موفقیت اعمال گردید."}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={executingActionIdx === i}
                            onClick={() => handleExecuteActionProposal(i, msg.actionProposal)}
                            className="flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-amber-500 transition-all disabled:opacity-50"
                          >
                            {executingActionIdx === i ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                            تایید و اعمال مستقیم روی اطلاعات سیستم
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1 text-[9px] opacity-70 border-t border-slate-800/50">
                      <span>{msg.timestamp}</span>
                      {msg.modelUsed && <span className="font-mono">{msg.modelUsed}</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {chatLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/30">
                  <RefreshCw className="h-4 w-4 animate-spin text-purple-400" />
                </div>
                <div className="rounded-2xl rounded-tl-none bg-slate-950 border border-slate-800 p-3.5 text-xs text-slate-400 flex items-center gap-2">
                  <span className="inline-block animate-pulse">هوش مصنوعی در حال تحلیل و پردازش درخواست شماست...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompts */}
          <div className="border-t border-slate-800/80 px-4 py-2 bg-slate-950/40 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
            <span className="text-slate-500 shrink-0 flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-400" />
              دستورات سریع:
            </span>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendChat(p)}
                className="shrink-0 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-300 hover:border-purple-500 hover:text-white transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <div className="border-t border-slate-800 p-3 bg-slate-950">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="دستور یا پرسش خود را بنویسید (مثلاً: قیمت محصولات را ۱۰ درصد به خاطر تورم زیاد کن)..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 disabled:opacity-50 transition-all shrink-0"
              >
                {chatLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                ارسال
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ANALYSIS MODE */}
      {activeMode === "analysis" && (
        <div className="space-y-6">
          <form
            onSubmit={handleRunAnalysis}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col sm:flex-row gap-3 shadow-xl"
          >
            <input
              type="text"
              placeholder="مثلاً: وضعیت سودآوری ماه جاری چگونه است و چه راهکاری برای کاهش هزینه‌های خرید پیشنهاد می‌کنی؟"
              value={analysisQuestion}
              onChange={(e) => setAnalysisQuestion(e.target.value)}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={analysisLoading || !analysisQuestion.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 transition-all shrink-0"
            >
              {analysisLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              تحلیل عمیق سیستم
            </button>
          </form>

          {analysisResult && (
            <div className="rounded-2xl border border-purple-500/30 bg-slate-900/80 p-6 shadow-2xl space-y-6 text-xs animate-in fade-in">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-2">
                <h3 className="font-bold text-cyan-300 text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  پاسخ و تحلیل مشاور هوشمند
                </h3>
                <p className="text-slate-200 leading-7 whitespace-pre-wrap">{analysisResult.answer}</p>
              </div>

              {/* Operational Facts */}
              <div className="space-y-2">
                <h3 className="font-bold text-purple-300 text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  حقایق مستخرج از دیتابیس (Operational Facts):
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
                  {analysisResult.facts?.map((f: string, idx: number) => (
                    <li key={idx}>{f}</li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="space-y-2 border-t border-slate-800 pt-4">
                <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  توصیه‌ها و اقدامات پیشنهادی:
                </h3>
                <div className="space-y-2">
                  {analysisResult.recommendations?.map((r: string, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
