import type { Tournament, Player, PlayerScore, ESPNEvent, ESPNCompetitor, GroupedPlayers } from "@/types";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/golf";

function mapESPNEventToTournament(event: ESPNEvent): Tournament {
  return {
    id: event.id,
    name: event.tournament?.displayName || event.name,
    startDate: event.date,
    endDate: event.endDate,
    courseName: event.courses?.[0]?.name || "TBD",
    purse: event.displayPurse,
    status: event.status.type.state as "pre" | "in" | "post",
    isMajor: event.tournament?.major || false,
  };
}

function mapCompetitorToPlayerScore(comp: ESPNCompetitor): PlayerScore {
  const statusName = comp.status.type.name;
  let status: PlayerScore["status"] = "playing";
  if (statusName === "STATUS_FINISH") status = "finished";
  else if (statusName === "STATUS_CUT") status = "cut";
  else if (statusName === "STATUS_WD") status = "wd";
  else if (statusName === "STATUS_DQ") status = "dq";

  const scoreToParStat = comp.statistics?.find((s) => s.name === "scoreToPar");
  const scoreToPar = scoreToParStat?.value ?? 0;

  return {
    playerId: comp.athlete.id,
    playerName: comp.athlete.displayName,
    scoreToPar,
    displayScore: comp.score.displayValue,
    status,
    position: comp.status.position?.displayName,
    roundScores: comp.linescores?.map((ls) => ls.displayValue),
    headshot: comp.athlete.headshot?.href,
    flagUrl: comp.athlete.flag?.href,
    thru: comp.status.thru,
    displayThru: comp.status.displayThru,
  };
}

export async function fetchCurrentTournaments(): Promise<Tournament[]> {
  const now = new Date();
  const endOfYear = new Date(now.getFullYear(), 11, 31);
  const formatDate = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const dateRange = `${formatDate(now)}-${formatDate(endOfYear)}`;

  const [leaderboardRes, scoreboardRes] = await Promise.all([
    fetch(`${ESPN_BASE}/leaderboard`),
    fetch(`${ESPN_BASE}/pga/scoreboard?dates=${dateRange}`),
  ]);

  const leaderboardData = leaderboardRes.ok ? await leaderboardRes.json() : { events: [] };
  const scoreboardData = scoreboardRes.ok ? await scoreboardRes.json() : { events: [] };

  // Merge and deduplicate by event ID
  const eventMap = new Map<string, ESPNEvent>();
  for (const event of [...(leaderboardData.events || []), ...(scoreboardData.events || [])]) {
    eventMap.set(event.id, event);
  }

  // Only show ongoing or future tournaments
  const tournaments = Array.from(eventMap.values())
    .map(mapESPNEventToTournament)
    .filter((t) => t.status === "in" || t.status === "pre");

  // Sort by start date — earliest first
  tournaments.sort((a, b) =>
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  return tournaments;
}

export async function fetchTournamentSchedule(year: number = new Date().getFullYear()): Promise<Tournament[]> {
  // ESPN doesn't have a dedicated schedule endpoint for golf, but we can
  // use the scoreboard endpoint for the season
  const res = await fetch(`${ESPN_BASE}/pga/scoreboard?dates=${year}`);
  if (!res.ok) {
    // Fallback to leaderboard which shows current/recent events
    return fetchCurrentTournaments();
  }
  const data = await res.json();
  return (data.events || []).map(mapESPNEventToTournament);
}

export async function fetchLeaderboard(eventId: string): Promise<PlayerScore[]> {
  const res = await fetch(`${ESPN_BASE}/leaderboard?event=${eventId}`);
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);
  const data = await res.json();
  const event = data.events?.[0];
  if (!event) return [];
  const competition = event.competitions?.[0];
  if (!competition) return [];
  return (competition.competitors || []).map(mapCompetitorToPlayerScore);
}

/**
 * Fetch the current status of a tournament from ESPN.
 * Returns "pre" (not started), "in" (in progress), or "post" (finished).
 */
export async function fetchTournamentStatus(eventId: string): Promise<"pre" | "in" | "post"> {
  const snapshot = await fetchTournamentSnapshot(eventId);
  return snapshot.status;
}

/**
 * Fetch the first tee time for Round 1 of a tournament.
 * Returns an ISO timestamp string, or null if tee times aren't available yet.
 */
export async function fetchFirstTeeTime(eventId: string): Promise<string | null> {
  const snapshot = await fetchTournamentSnapshot(eventId);
  return snapshot.firstTeeTime;
}

/**
 * Shared helper that fetches tournament data once and extracts both status
 * and the earliest Round 1 tee time from the ESPN leaderboard endpoint.
 */
export async function fetchTournamentSnapshot(eventId: string): Promise<{
  status: "pre" | "in" | "post";
  firstTeeTime: string | null;
}> {
  const res = await fetch(`${ESPN_BASE}/leaderboard?event=${eventId}`);
  if (!res.ok) return { status: "pre", firstTeeTime: null };
  const data = await res.json();
  const event = data.events?.[0];
  if (!event) return { status: "pre", firstTeeTime: null };

  const status = (event.status?.type?.state as "pre" | "in" | "post") || "pre";

  const competitors = event.competitions?.[0]?.competitors || [];
  const r1TeeTimes: string[] = [];
  for (const comp of competitors) {
    const teeTime =
      comp.linescores?.find((ls: { period: number; teeTime?: string }) => ls.period === 1)?.teeTime
      ?? comp.status?.teeTime;
    if (teeTime && !isNaN(Date.parse(teeTime))) {
      r1TeeTimes.push(teeTime);
    }
  }

  // ISO strings sort lexicographically = chronologically
  r1TeeTimes.sort();
  const firstTeeTime = r1TeeTimes[0] ?? null;

  return { status, firstTeeTime };
}

/**
 * Fetch the current round number for a tournament.
 * Derives from competitor linescores — the highest period with a score
 * across any competitor indicates the current round.
 * Returns round info including the next tee time, or null if not available.
 *
 * - `currentRound`: the latest round that has scores (completed or in progress)
 * - `displayRound`: the round to show to users — equals currentRound when play
 *   is in progress, or currentRound + 1 when the day's play is done and the
 *   next round hasn't started yet (capped at totalRounds)
 * - `nextRoundTeeTime`: the earliest tee time for `displayRound`
 */
export async function fetchCurrentRound(eventId: string): Promise<{
  currentRound: number;
  displayRound: number;
  totalRounds: number;
  nextRoundTeeTime: string | null;
} | null> {
  const res = await fetch(`${ESPN_BASE}/leaderboard?event=${eventId}`);
  if (!res.ok) return null;
  const data = await res.json();
  const event = data.events?.[0];
  if (!event) return null;

  const competitors = event.competitions?.[0]?.competitors || [];
  if (competitors.length === 0) return null;

  let maxPeriod = 0;
  let totalRounds = 4; // default for standard PGA events

  for (const comp of competitors) {
    if (!comp.linescores) continue;
    for (const ls of comp.linescores) {
      // Only count rounds with an actual score (not empty or "-")
      const hasScore = ls.displayValue && ls.displayValue !== "-" && ls.displayValue.trim() !== "";
      if (hasScore && ls.period > maxPeriod) maxPeriod = ls.period;
      if (ls.period > totalRounds) totalRounds = ls.period;
    }
  }

  if (maxPeriod === 0) return null;

  // Determine whether the current round is still in progress by checking
  // if any competitor is actively playing on the course right now.
  // ESPN uses STATUS_IN_PROGRESS / STATUS_PLAY for active play. Between rounds
  // players show STATUS_SCHEDULED, and after finishing STATUS_FINISH etc.
  const ACTIVE_PLAY_STATUSES = new Set(["STATUS_IN_PROGRESS", "STATUS_PLAY", "STATUS_ACTIVE"]);
  const isCurrentRoundInProgress = competitors.some((comp: ESPNCompetitor) => {
    const statusName = comp.status?.type?.name;
    return statusName != null && ACTIVE_PLAY_STATUSES.has(statusName);
  });

  // displayRound: show the next round when the current one is done,
  // but cap at totalRounds (don't show "Round 5 of 4").
  const displayRound = isCurrentRoundInProgress
    ? maxPeriod
    : Math.min(maxPeriod + 1, totalRounds);

  // The round we want tee times for matches displayRound.
  const teeTimeRound = isCurrentRoundInProgress ? maxPeriod : maxPeriod + 1;

  let nextRoundTeeTime: string | null = null;
  if (teeTimeRound <= totalRounds) {
    const teeTimes: string[] = [];
    for (const comp of competitors) {
      if (!comp.linescores) continue;
      const ls = comp.linescores.find(
        (l: { period: number; teeTime?: string }) => l.period === teeTimeRound
      );
      if (ls?.teeTime && !isNaN(Date.parse(ls.teeTime))) {
        teeTimes.push(ls.teeTime);
      }
    }
    teeTimes.sort();
    nextRoundTeeTime = teeTimes[0] ?? null;
  }

  return { currentRound: maxPeriod, displayRound, totalRounds, nextRoundTeeTime };
}

export async function fetchPlayersFromLeaderboard(eventId: string): Promise<Player[]> {
  const res = await fetch(`${ESPN_BASE}/leaderboard?event=${eventId}`);
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);
  const data = await res.json();
  const event = data.events?.[0];
  if (!event) return [];
  const competition = event.competitions?.[0];
  if (!competition) return [];

  const competitors = competition.competitors || [];

  // If the tournament hasn't started yet, it may have 0 competitors.
  // Fall back to the most recent completed tournament's player list.
  if (competitors.length === 0) {
    return fetchPlayersFromRecentTournament();
  }

  return competitors.map((comp: ESPNCompetitor) => ({
    id: comp.athlete.id,
    displayName: comp.athlete.displayName,
    shortName: comp.athlete.shortName,
    lastName: comp.athlete.lastName,
    headshot: comp.athlete.headshot?.href,
    flagUrl: comp.athlete.flag?.href,
    country: comp.athlete.flag?.alt,
    amateur: comp.athlete.amateur,
  }));
}

/**
 * Build dynamic player groups from the OWGR top 200.
 * Fetches via our own API route (server-side proxy) to avoid CORS issues.
 * Group A = rank 1-6, B = 7-12, C = 13-18, D = 19-24.
 * Wildcards = rank 25+.
 */
export async function fetchDynamicGroups(eventId?: string): Promise<{
  groups: GroupedPlayers;
  wildcards: Player[];
  fieldAvailable: boolean;
}> {
  try {
    const url = eventId ? `/api/rankings?eventId=${eventId}` : "/api/rankings";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Rankings API error");
    const data = await res.json();
    return {
      groups: data.groups,
      wildcards: data.wildcards,
      fieldAvailable: data.fieldAvailable ?? false,
    };
  } catch {
    // Fallback to hardcoded groups from playerGroups.ts
    const { PLAYER_GROUPS, getGroupedPlayerIds } = await import("@/lib/playerGroups");
    const recentPlayers = await fetchPlayersFromRecentTournament();
    const groupedIds = getGroupedPlayerIds();
    return {
      groups: PLAYER_GROUPS,
      wildcards: recentPlayers.filter((p) => !groupedIds.has(p.id)),
      fieldAvailable: false,
    };
  }
}

/**
 * Fetch players from the most recent completed PGA tournament.
 * Used as a last-resort fallback.
 */
async function fetchPlayersFromRecentTournament(): Promise<Player[]> {
  const res = await fetch(`${ESPN_BASE}/leaderboard`);
  if (!res.ok) return [];
  const data = await res.json();

  // Find the most recent completed event with competitors
  for (const event of data.events || []) {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];
    if (competitors.length > 0) {
      return competitors.map((comp: ESPNCompetitor) => ({
        id: comp.athlete.id,
        displayName: comp.athlete.displayName,
        shortName: comp.athlete.shortName,
        lastName: comp.athlete.lastName,
        headshot: comp.athlete.headshot?.href,
        flagUrl: comp.athlete.flag?.href,
        country: comp.athlete.flag?.alt,
        amateur: comp.athlete.amateur,
      }));
    }
  }
  return [];
}

/**
 * Calculate the effective score for a player, including missed cut penalty.
 * Per ADR-005: +1 penalty for CUT, WD, or DQ.
 */
export function calculateEffectiveScore(playerScore: PlayerScore): {
  effectiveScore: number;
  penalty: number;
} {
  const isPenalised = ["cut", "wd", "dq"].includes(playerScore.status);
  const penalty = isPenalised ? 1 : 0;
  return {
    effectiveScore: playerScore.scoreToPar + penalty,
    penalty,
  };
}

export function formatScoreToPar(score: number): string {
  if (score === 0) return "E";
  if (score > 0) return `+${score}`;
  return `${score}`;
}
