import { describe, it, expect } from "vitest";
import { hasIncompleteOrNoPicks } from "@/lib/firestore";
import type { Picks } from "@/types";

const completePicks: Picks = {
  groupA: { playerId: "a1", playerName: "Player A" },
  groupB: { playerId: "b1", playerName: "Player B" },
  groupC: { playerId: "c1", playerName: "Player C" },
  groupD: { playerId: "d1", playerName: "Player D" },
  wildcard1: { playerId: "w1", playerName: "Wildcard 1" },
  wildcard2: { playerId: "w2", playerName: "Wildcard 2" },
};

describe("hasIncompleteOrNoPicks", () => {
  it("returns true for null picks", () => {
    expect(hasIncompleteOrNoPicks(null)).toBe(true);
  });

  it("returns true for empty picks (all null)", () => {
    const picks: Picks = {
      groupA: null,
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    expect(hasIncompleteOrNoPicks(picks)).toBe(true);
  });

  it("returns true when only some groups are picked", () => {
    const picks: Picks = {
      ...completePicks,
      groupC: null,
      groupD: null,
    };
    expect(hasIncompleteOrNoPicks(picks)).toBe(true);
  });

  it("returns true when wildcards are missing", () => {
    const picks: Picks = {
      ...completePicks,
      wildcard1: null,
      wildcard2: null,
    };
    expect(hasIncompleteOrNoPicks(picks)).toBe(true);
  });

  it("returns true when only one wildcard is missing", () => {
    const picks: Picks = {
      ...completePicks,
      wildcard2: null,
    };
    expect(hasIncompleteOrNoPicks(picks)).toBe(true);
  });

  it("returns true when only one group is missing", () => {
    for (const group of ["groupA", "groupB", "groupC", "groupD"] as const) {
      const picks: Picks = { ...completePicks, [group]: null };
      expect(hasIncompleteOrNoPicks(picks)).toBe(true);
    }
  });

  it("returns false when all picks are complete", () => {
    expect(hasIncompleteOrNoPicks(completePicks)).toBe(false);
  });

  it("returns false when picks include optional lockedAt", () => {
    const picks: Picks = {
      ...completePicks,
      lockedAt: "2025-01-01T00:00:00Z",
    };
    expect(hasIncompleteOrNoPicks(picks)).toBe(false);
  });
});
