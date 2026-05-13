import { getParty, updatePartyStatus, updatePartyInvalidPicks, clearPartyInvalidPicks, updatePartyLastNotified, getUserEmail, getUsersInfo } from "@/lib/firestore";
import { fetchTournamentStatus } from "@/lib/espn";
import { validatePartyPicks } from "@/lib/pickValidation";
import type { Party } from "@/types";

const NOTIFICATION_COOLDOWN_MS = 1000 * 60 * 60; // 1 hour

/**
 * Check the live tournament status from ESPN and auto-update the party
 * status in Firestore if needed.
 *
 * Transitions:
 *   picking → locked   (when tournament starts: ESPN status "in") — only if all picks are valid
 *   picking → complete (when tournament ends: ESPN status "post") — only if all picks are valid
 *   locked  → complete (when tournament ends: ESPN status "post")
 *
 * If picks are invalid when trying to lock, the party stays in "picking"
 * and affected members are emailed to update their picks.
 *
 * Returns the updated party object.
 */
export async function syncPartyStatus(party: Party): Promise<Party> {
  const espnStatus = await fetchTournamentStatus(party.tournamentId);

  // locked → complete transition (no validation needed, picks already locked)
  if (party.status === "locked" && espnStatus === "post") {
    await updatePartyStatus(party.id, "complete");
    return { ...party, status: "complete" };
  }

  // picking → locked/complete transition (validate picks first)
  if (party.status === "picking" && (espnStatus === "in" || espnStatus === "post")) {
    const validation = await validatePartyPicks(party);

    if (validation.valid) {
      // All picks are valid — clear any previous invalid markers and lock
      if (party.invalidPicks && party.invalidPicks.length > 0) {
        await clearPartyInvalidPicks(party.id);
      }
      const newStatus = espnStatus === "post" ? "complete" : "locked";
      await updatePartyStatus(party.id, newStatus);
      return { ...party, status: newStatus, invalidPicks: [] };
    }

    // Invalid picks found — block the lock
    await updatePartyInvalidPicks(party.id, validation.invalidPicks);

    // Send email notifications (rate-limited)
    const shouldNotify =
      !party.lastInvalidNotifiedAt ||
      Date.now() - new Date(party.lastInvalidNotifiedAt).getTime() > NOTIFICATION_COOLDOWN_MS;

    if (shouldNotify) {
      await notifyInvalidPickMembers(party, validation.invalidPicks);
      await updatePartyLastNotified(party.id);
    }

    return { ...party, invalidPicks: validation.invalidPicks };
  }

  return party;
}

/**
 * Send email notifications to members with invalid picks.
 */
async function notifyInvalidPickMembers(
  party: Party,
  invalidPicks: { uid: string; playerName: string; slot: string }[]
): Promise<void> {
  // Group invalid picks by UID
  const byUid = new Map<string, string[]>();
  for (const pick of invalidPicks) {
    const existing = byUid.get(pick.uid) || [];
    existing.push(pick.playerName);
    byUid.set(pick.uid, existing);
  }

  // Fetch user info for affected UIDs
  const affectedUids = Array.from(byUid.keys());
  const usersInfo = await getUsersInfo(affectedUids);

  const invalidMembers: { email: string; displayName: string; invalidPlayers: string[] }[] = [];
  for (const uid of affectedUids) {
    const email = await getUserEmail(uid);
    if (!email) continue;
    const info = usersInfo[uid];
    invalidMembers.push({
      email,
      displayName: info?.displayName || "Player",
      invalidPlayers: byUid.get(uid) || [],
    });
  }

  if (invalidMembers.length === 0) return;

  // Fire-and-forget the email API call (server-side)
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    await fetch(`${baseUrl}/api/notify-invalid-picks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partyId: party.id,
        partyName: party.name,
        invalidMembers,
      }),
    });
  } catch (err) {
    console.error("Failed to send invalid picks notifications:", err);
  }
}
