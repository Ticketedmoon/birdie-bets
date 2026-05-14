import { NextRequest, NextResponse } from "next/server";
import { doc, setDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const db = () => getFirebaseDb();

function parseBrowser(ua: string): string {
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera";
  if (ua.includes("Chrome/") && ua.includes("Safari/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  if (ua.includes("MSIE") || ua.includes("Trident/")) return "IE";
  return "Other";
}

/**
 * POST /api/analytics — log a page view or click event
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      page?: string;
      uid?: string;
      email?: string;
      type?: "page_view" | "click";
      action?: string;
    };

    if (!body.page) {
      return NextResponse.json({ error: "Missing page" }, { status: 400 });
    }

    const ua = request.headers.get("user-agent") || "";
    const browser = parseBrowser(ua);
    const country = request.headers.get("x-vercel-ip-country") || "unknown";

    const eventRef = doc(collection(db(), "analytics"));
    await setDoc(eventRef, {
      type: body.type || "page_view",
      page: body.page,
      action: body.action || null,
      uid: body.uid || null,
      email: body.email || null,
      browser,
      country,
      userAgent: ua.slice(0, 256),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
  }
}

/**
 * GET /api/analytics — retrieve analytics summary (admin only)
 *
 * Requires ?email= matching ANALYTICS_ADMIN_EMAIL env var.
 */
export async function GET(request: NextRequest) {
  try {
    const callerEmail = request.nextUrl.searchParams.get("email");
    const adminEmail = process.env.ANALYTICS_ADMIN_EMAIL;

    if (!adminEmail || !callerEmail || callerEmail !== adminEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const days = parseInt(request.nextUrl.searchParams.get("days") || "7");
    const maxResults = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "200"),
      1000
    );

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let events: Record<string, unknown>[] = [];

    try {
      const q = query(
        collection(db(), "analytics"),
        orderBy("timestamp", "desc"),
        limit(maxResults)
      );
      const snap = await getDocs(q);
      events = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
        .filter((e) => (e.timestamp as string) >= since);
    } catch (queryError) {
      console.error("Analytics query failed:", queryError);
      return NextResponse.json(
        { error: "Failed to query analytics", detail: String(queryError) },
        { status: 500 }
      );
    }

    // Build summary
    const byPage: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byBrowser: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byUser: Record<string, { email: string | null; views: number; clicks: number }> = {};
    const userPageMap: Record<string, { email: string | null; page: string; count: number }> = {};

    for (const event of events) {
      const e = event as Record<string, unknown>;
      const page = (e.page as string) || "unknown";
      const ctry = (e.country as string) || "unknown";
      const brow = (e.browser as string) || "unknown";
      const type = (e.type as string) || "page_view";
      const uid = e.uid as string | null;
      const email = e.email as string | null;

      byPage[page] = (byPage[page] || 0) + 1;
      byCountry[ctry] = (byCountry[ctry] || 0) + 1;
      byBrowser[brow] = (byBrowser[brow] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;

      if (uid) {
        if (!byUser[uid]) byUser[uid] = { email: null, views: 0, clicks: 0 };
        if (email) byUser[uid].email = email;
        if (type === "click") byUser[uid].clicks++;
        else byUser[uid].views++;

        const key = `${uid}::${page}`;
        if (!userPageMap[key]) userPageMap[key] = { email, page, count: 0 };
        if (email) userPageMap[key].email = email;
        userPageMap[key].count++;
      }
    }

    return NextResponse.json({
      totalViews: events.length,
      uniqueUsers: Object.keys(byUser).length,
      days,
      byPage,
      byCountry,
      byBrowser,
      byType,
      byUser,
      byUserPage: Object.values(userPageMap).sort((a, b) => b.count - a.count),
      recentEvents: events.slice(0, 50),
    });
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
