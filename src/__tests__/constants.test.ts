import { describe, it, expect } from "vitest";
import {
  PICK_SLOT_DEFS,
  PICK_SLOTS,
  PICK_LABELS,
  AUTO_REFRESH_SECONDS,
  EMAIL_BANNER_MS,
  INVITE_RESULT_MS,
  COPY_FEEDBACK_MS,
  COUNTDOWN_TICK_MS,
  DEFAULT_TOTAL_ROUNDS,
  GROUP_SIZE,
} from "@/lib/constants";

describe("PICK_SLOT_DEFS", () => {
  it("has 6 slot definitions", () => {
    expect(PICK_SLOT_DEFS).toHaveLength(6);
  });

  it("has unique keys", () => {
    const keys = PICK_SLOT_DEFS.map((s) => s.key);
    expect(new Set(keys).size).toBe(6);
  });

  it("has unique labels", () => {
    const labels = PICK_SLOT_DEFS.map((s) => s.label);
    expect(new Set(labels).size).toBe(6);
  });
});

describe("PICK_SLOTS", () => {
  it("matches PICK_SLOT_DEFS keys", () => {
    expect(PICK_SLOTS).toEqual(PICK_SLOT_DEFS.map((s) => s.key));
  });
});

describe("PICK_LABELS", () => {
  it("matches PICK_SLOT_DEFS labels", () => {
    expect(PICK_LABELS).toEqual(PICK_SLOT_DEFS.map((s) => s.label));
  });
});

describe("timer constants", () => {
  it("AUTO_REFRESH_SECONDS is a positive number", () => {
    expect(AUTO_REFRESH_SECONDS).toBeGreaterThan(0);
  });

  it("all timer values are positive", () => {
    expect(EMAIL_BANNER_MS).toBeGreaterThan(0);
    expect(INVITE_RESULT_MS).toBeGreaterThan(0);
    expect(COPY_FEEDBACK_MS).toBeGreaterThan(0);
    expect(COUNTDOWN_TICK_MS).toBeGreaterThan(0);
  });
});

describe("golf constants", () => {
  it("DEFAULT_TOTAL_ROUNDS is 4", () => {
    expect(DEFAULT_TOTAL_ROUNDS).toBe(4);
  });

  it("GROUP_SIZE is 6", () => {
    expect(GROUP_SIZE).toBe(6);
  });
});
