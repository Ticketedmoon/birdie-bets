import { describe, it, expect } from "vitest";
import {
  PLAYER_GROUPS,
  GROUP_LABELS,
  getGroupedPlayerIds,
  isInGroups,
} from "@/lib/playerGroups";

describe("PLAYER_GROUPS", () => {
  it("has exactly 4 groups (A–D)", () => {
    expect(Object.keys(PLAYER_GROUPS)).toEqual(["A", "B", "C", "D"]);
  });

  it("each group has exactly 6 players", () => {
    for (const [group, players] of Object.entries(PLAYER_GROUPS)) {
      expect(players).toHaveLength(6);
    }
  });

  it("all player IDs across groups are unique", () => {
    const allIds = Object.values(PLAYER_GROUPS)
      .flat()
      .map((p) => p.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("GROUP_LABELS", () => {
  it("has labels for all 4 groups", () => {
    expect(Object.keys(GROUP_LABELS)).toEqual(["A", "B", "C", "D"]);
  });

  it("each label is a non-empty string", () => {
    for (const label of Object.values(GROUP_LABELS)) {
      expect(label).toBeTruthy();
      expect(typeof label).toBe("string");
    }
  });
});

describe("getGroupedPlayerIds", () => {
  it("returns a Set with 24 player IDs (6 per group × 4)", () => {
    const ids = getGroupedPlayerIds();
    expect(ids.size).toBe(24);
  });

  it("contains known player IDs from each group", () => {
    const ids = getGroupedPlayerIds();
    // Group A - Scottie Scheffler
    expect(ids.has("9478")).toBe(true);
    // Group B - Justin Rose
    expect(ids.has("1225")).toBe(true);
    // Group C - Sepp Straka
    expect(ids.has("9997")).toBe(true);
    // Group D - Jon Rahm
    expect(ids.has("9780")).toBe(true);
  });

  it("does not contain unknown IDs", () => {
    const ids = getGroupedPlayerIds();
    expect(ids.has("99999")).toBe(false);
    expect(ids.has("")).toBe(false);
  });
});

describe("isInGroups", () => {
  it("returns true for a player in the groups", () => {
    expect(isInGroups("9478")).toBe(true);
    expect(isInGroups("3702")).toBe(true);
  });

  it("returns false for a player not in the groups", () => {
    expect(isInGroups("99999")).toBe(false);
    expect(isInGroups("unknown")).toBe(false);
  });

  it("is consistent with getGroupedPlayerIds", () => {
    const ids = getGroupedPlayerIds();
    for (const id of ids) {
      expect(isInGroups(id)).toBe(true);
    }
    expect(isInGroups("not-in-group")).toBe(false);
  });
});
