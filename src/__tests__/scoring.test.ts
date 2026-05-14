import { describe, it, expect } from "vitest";
import { isCutStatus, getScoreColor, getTotalScoreColor } from "@/lib/scoring";

describe("isCutStatus", () => {
  it("returns true for cut", () => expect(isCutStatus("cut")).toBe(true));
  it("returns true for wd", () => expect(isCutStatus("wd")).toBe(true));
  it("returns true for dq", () => expect(isCutStatus("dq")).toBe(true));
  it("returns false for playing", () => expect(isCutStatus("playing")).toBe(false));
  it("returns false for finished", () => expect(isCutStatus("finished")).toBe(false));
});

describe("getScoreColor", () => {
  it("returns red for cut status regardless of score", () => {
    expect(getScoreColor(-5, "cut")).toBe("text-red-700");
    expect(getScoreColor(0, "wd")).toBe("text-red-700");
    expect(getScoreColor(3, "dq")).toBe("text-red-700");
  });

  it("returns red for under par", () => {
    expect(getScoreColor(-1)).toBe("text-red-600");
    expect(getScoreColor(-10, "playing")).toBe("text-red-600");
  });

  it("returns blue for over par", () => {
    expect(getScoreColor(1)).toBe("text-blue-600");
    expect(getScoreColor(5, "playing")).toBe("text-blue-600");
  });

  it("returns gray for even par", () => {
    expect(getScoreColor(0)).toBe("text-gray-500");
    expect(getScoreColor(0, "playing")).toBe("text-gray-500");
  });

  it("works without status parameter", () => {
    expect(getScoreColor(-3)).toBe("text-red-600");
    expect(getScoreColor(0)).toBe("text-gray-500");
    expect(getScoreColor(2)).toBe("text-blue-600");
  });
});

describe("getTotalScoreColor", () => {
  it("returns red for negative total", () => {
    expect(getTotalScoreColor(-5)).toBe("text-red-600");
  });

  it("returns blue for positive total", () => {
    expect(getTotalScoreColor(3)).toBe("text-blue-600");
  });

  it("returns gray for zero total", () => {
    expect(getTotalScoreColor(0)).toBe("text-gray-500");
  });
});
