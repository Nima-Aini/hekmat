import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      uptime: Date.now() - start,
    });
  } catch (error: any) {
    console.error("Health check error:", error);
    return NextResponse.json(
      { status: "error", message: "Healthcheck failed", database: "disconnected" },
      { status: 500 }
    );
  }
}
