import { getParty, updatePartyStatus } from "@/lib/firestore";
import { fetchTournamentStatus } from "@/lib/espn";
import type { Party } from "@/types";

/**
 * Check the live tournament status from ESPN and auto-update the party
 * status in Firestore if needed.
 *
 * Transitions:
 *   picking → locked   (when tournament starts: ESPN status "in")
 *   picking → locked   (when tournament ends: ESPN status "post" — skip straight to locked)
 *   locked  → complete (when tournament ends: ESPN status "post")
 *
 * Returns the updated party object.
 */
export async function syncPartyStatus(party: Party): Promise<Party> {
  const espnStatus = await fetchTournamentStatus(party.tournamentId);

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
