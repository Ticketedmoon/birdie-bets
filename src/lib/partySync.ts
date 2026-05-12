import { getParty, updatePartyStatus } from "@/lib/firestore";
import { fetchTournamentStatus } from "@/lib/espn";
import type { Party } from "@/types";

/**
 * Check the live tournament status from ESPN and auto-update the party
 * status in Firestore if needed.
 *
 * Transitions:
 *   picking → locked   (when tournament starts: ESPN status "in")
 *   picking → complete (when tournament ends: ESPN status "post")
 *   locked  → complete (when tournament ends: ESPN status "post")
 *
 * Grace period: parties created less than 10 minutes ago won't auto-lock,
 * giving users time to submit picks (also useful for testing with past tournaments).
 *
 * Returns the updated party object.
 */
export async function syncPartyStatus(party: Party): Promise<Party> {
  const espnStatus = await fetchTournamentStatus(party.tournamentId);

  // Grace period: don't auto-lock brand new parties (< 10 min old)
  const ageMs = Date.now() - new Date(party.createdAt).getTime();
  const GRACE_PERIOD_MS = 10 * 60 * 1000; // 10 minutes
  if (party.status === "picking" && ageMs < GRACE_PERIOD_MS) {
    return party;
  }

  let newStatus: Party["status"] | null = null;

  if (party.status === "picking" && (espnStatus === "in" || espnStatus === "post")) {
    newStatus = espnStatus === "post" ? "complete" : "locked";
  } else if (party.status === "locked" && espnStatus === "post") {
    newStatus = "complete";
  }

  if (newStatus && newStatus !== party.status) {
    await updatePartyStatus(party.id, newStatus);
    return { ...party, status: newStatus };
  }

  return party;
}
