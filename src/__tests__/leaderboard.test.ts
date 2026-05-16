import { describe, it, expect } from "vitest";
import { buildLeaderboardEntries } from "@/lib/leaderboard";
import type { Party, Picks, PlayerScore } from "@/types";
import { mockParty, completePicks } from "./helpers";

function makeScore(overrides: Partial<PlayerScore> = {}): PlayerScore {
  return {
    playerId: "p1",
    playerName: "Player One",
    scoreToPar: -2,
    displayScore: "-2",
    status: "playing",
    ...overrides,
  };
}

const party: Party = {
  ...mockParty,
  memberUids: ["uid1", "uid2"],
};

const usersInfo: Record<string, { displayName: string; photoURL?: string }> = {
  uid1: { displayName: "Alice" },
  uid2: { displayName: "Bob", photoURL: "https://photo.url" },
};

describe("buildLeaderboardEntries", () => {
  it("builds entries for all party members", () => {
    const allPicks: Record<string, Picks> = {
      uid1: completePicks,
      uid2: completePicks,
    };
    const scores = [
      makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: -3 }),
      makeScore({ playerId: "b1", playerName: "Player B", scoreToPar: 0 }),
      makeScore({ playerId: "c1", playerName: "Player C", scoreToPar: 1 }),
      makeScore({ playerId: "d1", playerName: "Player D", scoreToPar: 2 }),
      makeScore({ playerId: "w1", playerName: "Wildcard 1", scoreToPar: -1 }),
      makeScore({ playerId: "w2", playerName: "Wildcard 2", scoreToPar: 0 }),
    ];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);

    expect(entries).toHaveLength(2);
    expect(entries[0].userName).toBe("Alice");
    expect(entries[0].picks).toHaveLength(6);
  });

  it("sorts entries by total score (lowest first)", () => {
    const allPicks: Record<string, Picks> = {
      uid1: completePicks,
      uid2: completePicks,
    };
    const scoresUid1 = [
      makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: 5 }),
      makeScore({ playerId: "b1", playerName: "Player B", scoreToPar: 5 }),
      makeScore({ playerId: "c1", playerName: "Player C", scoreToPar: 5 }),
      makeScore({ playerId: "d1", playerName: "Player D", scoreToPar: 5 }),
      makeScore({ playerId: "w1", playerName: "Wildcard 1", scoreToPar: 5 }),
      makeScore({ playerId: "w2", playerName: "Wildcard 2", scoreToPar: 5 }),
    ];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scoresUid1);

    // Both have same picks/scores so order is stable
    expect(entries[0].totalScore).toBeLessThanOrEqual(entries[1].totalScore);
  });

  it("handles member with no picks", () => {
    const allPicks: Record<string, Picks> = {};
    const scores: PlayerScore[] = [];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);

    expect(entries).toHaveLength(2);
    expect(entries[0].picks).toEqual([]);
    expect(entries[0].totalScore).toBe(0);
  });

  it("handles unknown user info gracefully", () => {
    const allPicks: Record<string, Picks> = {};
    const entries = buildLeaderboardEntries(party, allPicks, {}, []);

    expect(entries[0].userName).toBe("Unknown");
  });

  it("shows 'Not picked' for null pick slots", () => {
    const partialPicks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: partialPicks };
    const scores = [makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: -1 })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].playerName).toBe("Player A");
    expect(uid1Entry.picks[1].playerName).toBe("Not picked");
  });

  it("matches scores by player name when ID doesn't match", () => {
    const picks: Picks = {
      groupA: { playerId: "wrong-id", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({ playerId: "correct-id", playerName: "Player A", scoreToPar: -5 })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].playerName).toBe("Player A");
    expect(uid1Entry.picks[0].scoreToPar).toBe(-5);
  });

  it("applies cutLine-based penalty to cut player scores", () => {
    const picks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: 7, status: "cut" })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores, 4);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    // cutLine 4 + 1 = 5 (capped), not 7 + 1 = 8
    expect(uid1Entry.picks[0].scoreToPar).toBe(5);
    expect(uid1Entry.picks[0].displayScore).toBe("+5");
  });

  it("falls back to +1 penalty for cut player when no cutLine provided", () => {
    const picks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: 3, status: "cut" })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    // No cutLine, so fallback: 3 + 1 = 4
    expect(uid1Entry.picks[0].scoreToPar).toBe(4);
    expect(uid1Entry.picks[0].displayScore).toBe("+4 (+1)");
  });

  it("returns dash score when player not found in leaderboard", () => {
    const picks: Picks = {
      groupA: { playerId: "missing-id", playerName: "Missing Player" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    // No matching score in the leaderboard
    const scores = [makeScore({ playerId: "other-id", playerName: "Other Player" })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].playerName).toBe("Missing Player");
    expect(uid1Entry.picks[0].displayScore).toBe("-");
    expect(uid1Entry.picks[0].scoreToPar).toBe(0);
  });
});
