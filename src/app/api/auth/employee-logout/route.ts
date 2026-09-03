import { NextResponse } from "next/server";

export async function POST() {
  const r = NextResponse.json({ success: true });
  r.cookies.set("employee_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SECURE_COOKIES !== "false" && process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
  return r;
}
