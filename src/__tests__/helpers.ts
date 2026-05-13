import type { Party, Picks, PickUnlock } from "@/types";

export const CREATOR_UID = "creator-uid-123";
export const TARGET_UID = "target-uid-456";
export const PARTY_ID = "party-abc";

export const mockParty: Party = {
  id: PARTY_ID,
  name: "Test Party",
  createdBy: CREATOR_UID,
  inviteCode: "ABC123",
  tournamentId: "t1",
  tournamentName: "The Masters",
  tournamentStartDate: "2025-04-10T00:00:00Z",
  createdAt: "2025-04-01T00:00:00Z",
  status: "locked",
  memberUids: [CREATOR_UID, TARGET_UID],
  buyIn: 10,
  currency: "EUR",
  secondPlacePayout: false,
  thirdPlacePayout: false,
};

export const completePicks: Picks = {
  groupA: { playerId: "a1", playerName: "Player A" },
  groupB: { playerId: "b1", playerName: "Player B" },
  groupC: { playerId: "c1", playerName: "Player C" },
  groupD: { playerId: "d1", playerName: "Player D" },
  wildcard1: { playerId: "w1", playerName: "Wildcard 1" },
  wildcard2: { playerId: "w2", playerName: "Wildcard 2" },
};

export const incompletePicks: Picks = {
  groupA: { playerId: "a1", playerName: "Player A" },
  groupB: null,
  groupC: null,
  groupD: null,
  wildcard1: null,
  wildcard2: null,
};

export function makeValidUnlock(overrides: Partial<PickUnlock> = {}): PickUnlock {
  return {
    uid: TARGET_UID,
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 min ago
    expiresAt: new Date(Date.now() + 1000 * 60 * 50).toISOString(), // 50 min from now
    used: false,
    createdBy: CREATOR_UID,
    ...overrides,
  };
}

export function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
