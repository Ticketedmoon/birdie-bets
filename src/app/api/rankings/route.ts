import { NextRequest, NextResponse } from "next/server";

const OWGR_API = "https://apiweb.owgr.com/api/owgr/rankings/getRankings";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/golf";

interface OWGREntry {
  rank: number;
  player: {
    id: number;
    firstName: string;
    lastName: string;
    fullName: string;
    isAmateur: boolean;
    country: { code3: string; name: string };
  };
}

interface OWGRPlayer {
  id: string;
  displayName: string;
  shortName: string;
  lastName: string;
  amateur: boolean;
  country: string;
  rank: number;
}

// Cache per tournament (keyed by eventId)
const cacheMap = new Map<string, { data: unknown; fetchedAt: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

/**
 * Fetch tournament field from ESPN. Returns a Set of lowercase player names.
 * Returns null if field is not yet available (future tournaments).
 */
async function fetchTournamentField(eventId: string): Promise<Set<string> | null> {
  try {
    const res = await fetch(`${ESPN_BASE}/leaderboard?event=${eventId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const competitors = data.events?.[0]?.competitions?.[0]?.competitors || [];
    if (competitors.length === 0) return null;
    return new Set(competitors.map((c: { athlete: { displayName: string } }) =>
      c.athlete.displayName.toLowerCase()
    ));
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") || "";
  const cacheKey = eventId || "_all";

  // Return cache if fresh
  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Fetch OWGR rankings and tournament field in parallel
    const [owgrRes, field] = await Promise.all([
      fetch(`${OWGR_API}?pageSize=200&pageNumber=1`),
      eventId ? fetchTournamentField(eventId) : Promise.resolve(null),
    ]);

    if (!owgrRes.ok) throw new Error(`OWGR API error: ${owgrRes.status}`);
    const raw = await owgrRes.json();

    let players: OWGRPlayer[] = (raw.rankingsList || []).map((entry: OWGREntry) => ({
      id: `owgr_${entry.player.id}`,
      displayName: entry.player.fullName,
      shortName: `${entry.player.firstName[0]}. ${entry.player.lastName}`,
      lastName: entry.player.lastName,
      amateur: entry.player.isAmateur,
      country: entry.player.country?.name || entry.player.country?.code3,
      rank: entry.rank,
    }));

    // If we have a tournament field, filter to only players in the field
    const fieldAvailable = field !== null && field.size > 0;
    if (fieldAvailable) {
      players = players.filter((p) => field.has(p.displayName.toLowerCase()));
    }

    // Build groups from the filtered list (first 6 = A, next 6 = B, etc.)
    const result = {
      groups: {
        A: players.slice(0, 6),
        B: players.slice(6, 12),
        C: players.slice(12, 18),
        D: players.slice(18, 24),
      },
      wildcards: players.slice(24),
      fieldAvailable,
      fetchedAt: new Date().toISOString(),
    };

    cacheMap.set(cacheKey, { data: result, fetchedAt: Date.now() });
    return NextResponse.json(result);
  } catch (error) {
    console.error("OWGR fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rankings" },
      { status: 500 }
    );
  }
}
