import type { Party, Picks, PlayerScore } from "@/types";
import { getAllPicksForParty } from "@/lib/firestore";
import { fetchLeaderboard } from "@/lib/espn";

export interface InvalidPick {
  uid: string;
  playerName: string;
  slot: string;
}

export interface ValidationResult {
  valid: boolean;
  invalidPicks: InvalidPick[];
}

const PICK_SLOTS = ["groupA", "groupB", "groupC", "groupD", "wildcard1", "wildcard2"] as const;

/**
 * Validate all party members' picks against the confirmed ESPN tournament field.
 * Uses name-based matching (normalised, case-insensitive) per ADR-014.
 */
export async function validatePartyPicks(party: Party): Promise<ValidationResult> {
  const [allPicks, leaderboardResult] = await Promise.all([
    getAllPicksForParty(party.id),
    fetchLeaderboard(party.tournamentId),
  ]);

  const leaderboard = leaderboardResult.scores;

  // No field data yet — can't validate, assume valid
  if (leaderboard.length === 0) {
    return { valid: true, invalidPicks: [] };
  }

  const fieldNames = buildFieldNameSet(leaderboard);
  const invalidPicks: InvalidPick[] = [];

  for (const [uid, picks] of Object.entries(allPicks)) {
    for (const slot of PICK_SLOTS) {
      const pick = picks[slot as keyof Picks];
      if (!pick || typeof pick !== "object" || !("playerName" in pick)) continue;

      const playerName = (pick as { playerName: string }).playerName;
      if (!isPlayerInField(playerName, fieldNames)) {
        invalidPicks.push({ uid, playerName, slot });
      }
    }
  }

  return { valid: invalidPicks.length === 0, invalidPicks };
}

/**
 * Build a set of normalised player names from ESPN leaderboard data.
 */
function buildFieldNameSet(leaderboard: PlayerScore[]): Set<string> {
  return new Set(leaderboard.map((p) => normaliseName(p.playerName)));
}

/**
 * Check if a player name matches any name in the field.
 * Uses normalised comparison to handle accents and casing differences.
 */
function isPlayerInField(playerName: string, fieldNames: Set<string>): boolean {
  return fieldNames.has(normaliseName(playerName));
}

/**
 * Normalise a player name for comparison:
 * - Lowercase
 * - Strip accents (e.g. Å → A)
 * - Collapse whitespace
 */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
