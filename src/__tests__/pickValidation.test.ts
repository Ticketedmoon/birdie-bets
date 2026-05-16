import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Party, Picks, PlayerScore } from "@/types";
import { mockParty } from "./helpers";

// Mock dependencies
vi.mock("@/lib/firestore", () => ({
  getAllPicksForParty: vi.fn(),
}));

vi.mock("@/lib/espn", () => ({
  fetchLeaderboard: vi.fn(),
}));

import { validatePartyPicks } from "@/lib/pickValidation";
import * as firestore from "@/lib/firestore";
import * as espn from "@/lib/espn";

const mocks = {
  getAllPicksForParty: vi.mocked(firestore.getAllPicksForParty),
  fetchLeaderboard: vi.mocked(espn.fetchLeaderboard),
};

function makeLeaderboardPlayer(name: string): PlayerScore {
  return {
    playerId: "id",
    playerName: name,
    scoreToPar: 0,
    displayScore: "E",
    status: "playing",
  };
}

function makePicksForUser(names: Record<string, string>): Picks {
  const slots = ["groupA", "groupB", "groupC", "groupD", "wildcard1", "wildcard2"] as const;
  const picks: Picks = {
    groupA: null,
    groupB: null,
    groupC: null,
    groupD: null,
    wildcard1: null,
    wildcard2: null,
  };
  for (const slot of slots) {
    if (names[slot]) {
      (picks as Record<string, unknown>)[slot] = { playerId: "id", playerName: names[slot] };
    }
  }
  return picks;
}

const party: Party = { ...mockParty, status: "picking" };

describe("validatePartyPicks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid when leaderboard is empty (no field data yet)", async () => {
    mocks.getAllPicksForParty.mockResolvedValue({
      uid1: makePicksForUser({ groupA: "Player A" }),
    });
    mocks.fetchLeaderboard.mockResolvedValue({ scores: [], cutLine: null, cutRound: null });

    const result = await validatePartyPicks(party);
    expect(result.valid).toBe(true);
    expect(result.invalidPicks).toEqual([]);
  });

  it("returns valid when all picks match the field", async () => {
    mocks.getAllPicksForParty.mockResolvedValue({
      uid1: makePicksForUser({
        groupA: "Scottie Scheffler",
        groupB: "Rory McIlroy",
      }),
    });
    mocks.fetchLeaderboard.mockResolvedValue({ scores: [
      makeLeaderboardPlayer("Scottie Scheffler"),
      makeLeaderboardPlayer("Rory McIlroy"),
    ], cutLine: null, cutRound: null });

    const result = await validatePartyPicks(party);
    expect(result.valid).toBe(true);
    expect(result.invalidPicks).toEqual([]);
  });

  it("detects invalid picks not in the field", async () => {
    mocks.getAllPicksForParty.mockResolvedValue({
      uid1: makePicksForUser({
        groupA: "Tiger Woods",
        groupB: "Rory McIlroy",
      }),
    });
    mocks.fetchLeaderboard.mockResolvedValue({ scores: [
      makeLeaderboardPlayer("Scottie Scheffler"),
      makeLeaderboardPlayer("Rory McIlroy"),
    ], cutLine: null, cutRound: null });

    const result = await validatePartyPicks(party);
    expect(result.valid).toBe(false);
    expect(result.invalidPicks).toEqual([
      { uid: "uid1", playerName: "Tiger Woods", slot: "groupA" },
    ]);
  });

  it("handles case-insensitive matching", async () => {
    mocks.getAllPicksForParty.mockResolvedValue({
      uid1: makePicksForUser({ groupA: "SCOTTIE SCHEFFLER" }),
    });
    mocks.fetchLeaderboard.mockResolvedValue({ scores: [
      makeLeaderboardPlayer("Scottie Scheffler"),
    ], cutLine: null, cutRound: null });

    const result = await validatePartyPicks(party);
    expect(result.valid).toBe(true);
  });

  it("handles accent normalization (e.g. Åberg → Aberg)", async () => {
    mocks.getAllPicksForParty.mockResolvedValue({
      uid1: makePicksForUser({ groupA: "Ludvig Aberg" }),
    });
    mocks.fetchLeaderboard.mockResolvedValue({ scores: [
      makeLeaderboardPlayer("Ludvig Åberg"),
    ], cutLine: null, cutRound: null });

    const result = await validatePartyPicks(party);
    expect(result.valid).toBe(true);
  });

  it("handles extra whitespace in names", async () => {
    mocks.getAllPicksForParty.mockResolvedValue({
      uid1: makePicksForUser({ groupA: "  Rory   McIlroy  " }),
    });
    mocks.fetchLeaderboard.mockResolvedValue({ scores: [
      makeLeaderboardPlayer("Rory McIlroy"),
    ], cutLine: null, cutRound: null });

    const result = await validatePartyPicks(party);
    expect(result.valid).toBe(true);
  });

  it("skips null pick slots", async () => {
    mocks.getAllPicksForParty.mockResolvedValue({
      uid1: makePicksForUser({ groupA: "Scottie Scheffler" }),
      // other slots are null
    });
    mocks.fetchLeaderboard.mockResolvedValue({ scores: [
      makeLeaderboardPlayer("Scottie Scheffler"),
    ], cutLine: null, cutRound: null });

    const result = await validatePartyPicks(party);
    expect(result.valid).toBe(true);
  });

  it("reports multiple invalid picks across multiple users", async () => {
    mocks.getAllPicksForParty.mockResolvedValue({
      uid1: makePicksForUser({ groupA: "Invalid Player 1" }),
      uid2: makePicksForUser({ groupB: "Invalid Player 2" }),
    });
    mocks.fetchLeaderboard.mockResolvedValue({ scores: [
      makeLeaderboardPlayer("Scottie Scheffler"),
    ], cutLine: null, cutRound: null });

    const result = await validatePartyPicks(party);
    expect(result.valid).toBe(false);
    expect(result.invalidPicks).toHaveLength(2);
    expect(result.invalidPicks).toContainEqual({
      uid: "uid1",
      playerName: "Invalid Player 1",
      slot: "groupA",
    });
    expect(result.invalidPicks).toContainEqual({
      uid: "uid2",
      playerName: "Invalid Player 2",
      slot: "groupB",
    });
  });

  it("reports multiple invalid picks from same user across slots", async () => {
    mocks.getAllPicksForParty.mockResolvedValue({
      uid1: makePicksForUser({
        groupA: "Bad Pick A",
        groupB: "Bad Pick B",
      }),
    });
    mocks.fetchLeaderboard.mockResolvedValue({ scores: [
      makeLeaderboardPlayer("Scottie Scheffler"),
    ], cutLine: null, cutRound: null });

    const result = await validatePartyPicks(party);
    expect(result.valid).toBe(false);
    expect(result.invalidPicks).toHaveLength(2);
  });

  it("handles combined accent, case, and whitespace normalization", async () => {
    mocks.getAllPicksForParty.mockResolvedValue({
      uid1: makePicksForUser({ groupA: "  LUDVIG   ABERG  " }),
    });
    mocks.fetchLeaderboard.mockResolvedValue({ scores: [
      makeLeaderboardPlayer("Ludvig Åberg"),
    ], cutLine: null, cutRound: null });

    const result = await validatePartyPicks(party);
    expect(result.valid).toBe(true);
  });
});
