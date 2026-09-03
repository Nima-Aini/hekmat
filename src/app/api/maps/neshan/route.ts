import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_NESHAN_KEY = "service.3a9a6b9c59054a20a4786affab22c5d7";

async function getNeshanKey(providedKey?: string | null): Promise<string> {
  if (providedKey && providedKey.trim().length > 5) {
    return providedKey.trim();
  }
  if (process.env.NESHAN_API_KEY) {
    return process.env.NESHAN_API_KEY;
  }
  try {
    const [settings] = await db
      .select({ neshanApiKey: systemSettings.neshanApiKey })
      .from(systemSettings)
      .where(eq(systemSettings.id, "main_config"))
      .limit(1);
    if (settings?.neshanApiKey && settings.neshanApiKey.trim().length > 5) {
      return settings.neshanApiKey.trim();
    }
  } catch (e) {
    console.error("Error reading neshanApiKey from DB:", e);
  }
  return DEFAULT_NESHAN_KEY;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "search";
    const customKey = searchParams.get("apiKey");
    const apiKey = await getNeshanKey(customKey);

    if (action === "search") {
      const term = searchParams.get("term") || searchParams.get("q") || "";
      const lat = searchParams.get("lat") || "35.6892";
      const lng = searchParams.get("lng") || "51.3890";

      if (!term.trim()) {
        return NextResponse.json({ success: true, count: 0, items: [] });
      }

      const neshanUrl = `https://api.neshan.org/v1/search?term=${encodeURIComponent(term)}&lat=${lat}&lng=${lng}`;
      const res = await fetch(neshanUrl, {
        headers: {
          "Api-Key": apiKey,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn("Neshan Search API error response:", res.status, errText);
        return NextResponse.json({
          success: false,
          error: `Neshan API HTTP ${res.status}`,
          items: [],
        }, { status: 200 });
      }

      const data = await res.json();
      return NextResponse.json({
        success: true,
        count: data.count || data.items?.length || 0,
        items: data.items || [],
      });
    }

    if (action === "reverse") {
      const lat = searchParams.get("lat");
      const lng = searchParams.get("lng");

      if (!lat || !lng) {
        return NextResponse.json({ success: false, error: "lat و lng الزامی هستند." }, { status: 400 });
      }

      const neshanUrl = `https://api.neshan.org/v5/reverse?lat=${lat}&lng=${lng}`;
      const res = await fetch(neshanUrl, {
        headers: {
          "Api-Key": apiKey,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn("Neshan Reverse API error response:", res.status, errText);
        return NextResponse.json({
          success: false,
          error: `Neshan Reverse API HTTP ${res.status}`,
        }, { status: 200 });
      }

      const data = await res.json();
      return NextResponse.json({
        success: true,
        data: {
          formatted_address: data.formatted_address || data.address || "",
          route_name: data.route_name || "",
          neighbourhood: data.neighbourhood || "",
          city: data.city || data.municipality_zone || "",
          state: data.state || "",
          in_traffic_zone: data.in_traffic_zone || false,
          in_odd_even_zone: data.in_odd_even_zone || false,
          raw: data,
        },
      });
    }

    return NextResponse.json({ success: false, error: "عملیات نامعتبر است." }, { status: 400 });
  } catch (error: any) {
    console.error("Neshan API Route error:", error);
    return NextResponse.json({ success: false, error: error.message || "خطای سرور" }, { status: 500 });
  }
}
