import type { Picks } from "@/types";

/**
 * Pick slot definitions — single source of truth for slot keys and labels.
 * Used in validation, leaderboard rendering, and pick display.
 */
export const PICK_SLOT_DEFS = [
  { key: "groupA" as const, label: "A" },
  { key: "groupB" as const, label: "B" },
  { key: "groupC" as const, label: "C" },
  { key: "groupD" as const, label: "D" },
  { key: "wildcard1" as const, label: "W1" },
  { key: "wildcard2" as const, label: "W2" },
] as const;

/** Just the slot keys, for iteration */
export const PICK_SLOTS = PICK_SLOT_DEFS.map((s) => s.key);

/** Just the labels, for display */
export const PICK_LABELS = PICK_SLOT_DEFS.map((s) => s.label);

export type PickSlotKey = (typeof PICK_SLOT_DEFS)[number]["key"];

// --- Timer constants ---

/** Seconds between auto-refreshes on the party page */
export const AUTO_REFRESH_SECONDS = 300;

/** How long the email-sent banner shows (ms) */
export const EMAIL_BANNER_MS = 8000;

/** How long the invite result message shows (ms) */
export const INVITE_RESULT_MS = 3000;

/** How long the "Copied" feedback shows after copying invite link (ms) */
export const COPY_FEEDBACK_MS = 2000;

/** Interval for the tee-off countdown timer (ms) */
export const COUNTDOWN_TICK_MS = 60_000;

/** Default number of rounds in a PGA tournament */
export const DEFAULT_TOTAL_ROUNDS = 4;

/** Group size for OWGR-based player grouping */
export const GROUP_SIZE = 6;
