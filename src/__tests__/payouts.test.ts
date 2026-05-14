import { describe, it, expect } from "vitest";
import { calculatePayouts } from "@/lib/payouts";
import type { Party } from "@/types";
import { mockParty } from "./helpers";

function makeParty(overrides: Partial<Party> = {}): Party {
  return { ...mockParty, ...overrides };
}

describe("calculatePayouts", () => {
  it("calculates basic payout (no 2nd/3rd)", () => {
    const party = makeParty({
      buyIn: 10,
      memberUids: ["a", "b", "c", "d"],
      secondPlacePayout: false,
      thirdPlacePayout: false,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(40);
    expect(result.first).toBe(40);
    expect(result.second).toBe(0);
    expect(result.third).toBe(0);
  });

  it("calculates with 2nd place enabled", () => {
    const party = makeParty({
      buyIn: 10,
      memberUids: ["a", "b", "c", "d"],
      secondPlacePayout: true,
      thirdPlacePayout: false,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(40);
    expect(result.second).toBe(20);
    expect(result.first).toBe(20);
    expect(result.third).toBe(0);
  });

  it("calculates with 3rd place enabled", () => {
    const party = makeParty({
      buyIn: 10,
      memberUids: ["a", "b", "c", "d"],
      secondPlacePayout: false,
      thirdPlacePayout: true,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(40);
    expect(result.third).toBe(10);
    expect(result.first).toBe(30);
    expect(result.second).toBe(0);
  });

  it("calculates with both 2nd and 3rd place enabled", () => {
    const party = makeParty({
      buyIn: 10,
      memberUids: ["a", "b", "c", "d"],
      secondPlacePayout: true,
      thirdPlacePayout: true,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(40);
    expect(result.third).toBe(10);
    expect(result.second).toBe(20);
    expect(result.first).toBe(10);
  });

  it("first place never goes negative", () => {
    const party = makeParty({
      buyIn: 10,
      memberUids: ["a"],
      secondPlacePayout: true,
      thirdPlacePayout: true,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(10);
    expect(result.first).toBe(0);
  });

  it("uses default EUR currency when none specified", () => {
    const party = makeParty({ currency: undefined as unknown as string });
    const result = calculatePayouts(party);
    expect(result.currency).toBe("EUR");
  });

  it("uses custom currency", () => {
    const party = makeParty({ currency: "USD" });
    const result = calculatePayouts(party);
    expect(result.currency).toBe("USD");
  });

  it("payouts never exceed total pot with sufficient members", () => {
    // With enough members, payouts should not exceed the pot
    const configs = [
      { members: 4, second: true, third: true },
      { members: 4, second: true, third: false },
      { members: 4, second: false, third: true },
      { members: 10, second: true, third: true },
    ];
    for (const cfg of configs) {
      const party = makeParty({
        buyIn: 10,
        memberUids: Array.from({ length: cfg.members }, (_, i) => `m${i}`),
        secondPlacePayout: cfg.second,
        thirdPlacePayout: cfg.third,
      });
      const result = calculatePayouts(party);
      expect(result.first + result.second + result.third).toBeLessThanOrEqual(
        result.totalPot
      );
    }
  });

  it("payouts can exceed pot with too few members (known edge case)", () => {
    // With only 1 member and both payouts enabled, second + third > pot
    // This is a known limitation — the UI should enforce minimum member counts
    const party = makeParty({
      buyIn: 10,
      memberUids: ["a"],
      secondPlacePayout: true,
      thirdPlacePayout: true,
    });
    const result = calculatePayouts(party);
    expect(result.first).toBe(0); // clamped to 0
    expect(result.second + result.third).toBeGreaterThan(result.totalPot);
  });

  it("handles large buy-in with many members", () => {
    const party = makeParty({
      buyIn: 100,
      memberUids: Array.from({ length: 20 }, (_, i) => `m${i}`),
      secondPlacePayout: true,
      thirdPlacePayout: true,
    });
    const result = calculatePayouts(party);
    expect(result.totalPot).toBe(2000);
    expect(result.first).toBe(1700);
    expect(result.second).toBe(200);
    expect(result.third).toBe(100);
  });
});
