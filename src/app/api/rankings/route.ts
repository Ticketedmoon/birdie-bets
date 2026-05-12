import { NextResponse } from "next/server";

const OWGR_API = "https://apiweb.owgr.com/api/owgr/rankings/getRankings";

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

// In-memory cache (server-side)
let cache: { data: unknown; fetchedAt: number } | null = null;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function GET() {
  // Return cache if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(`${OWGR_API}?pageSize=200&pageNumber=1`);
    if (!res.ok) throw new Error(`OWGR API error: ${res.status}`);
    const raw = await res.json();

    const players = (raw.rankingsList || []).map((entry: OWGREntry) => ({
      id: `owgr_${entry.player.id}`,
      displayName: entry.player.fullName,
      shortName: `${entry.player.firstName[0]}. ${entry.player.lastName}`,
      lastName: entry.player.lastName,
      amateur: entry.player.isAmateur,
      country: entry.player.country?.name || entry.player.country?.code3,
      rank: entry.rank,
    }));

    const result = {
      groups: {
        A: players.slice(0, 6),
        B: players.slice(6, 12),
        C: players.slice(12, 18),
        D: players.slice(18, 24),
      },
      wildcards: players.slice(24),
      fetchedAt: new Date().toISOString(),
    };

    cache = { data: result, fetchedAt: Date.now() };
    return NextResponse.json(result);
  } catch (error) {
    console.error("OWGR fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rankings" },
      { status: 500 }
    );
  }
}
