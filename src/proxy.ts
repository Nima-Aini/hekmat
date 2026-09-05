import { NextRequest, NextResponse } from "next/server";
export function proxy(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return NextResponse.next();
  const origin = req.headers.get("origin");
  let crossOrigin = req.headers.get("sec-fetch-site") === "cross-site";
  if (origin) {
    try { crossOrigin ||= new URL(origin).host !== req.headers.get("host"); }
    catch { crossOrigin = true; }
  }
  if (crossOrigin) return NextResponse.json({ success: false, error: "مبدأ درخواست مجاز نیست." }, { status: 403 });
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
