import type { PlayerScore } from "@/types";

/** Statuses that indicate a golfer did not complete the tournament */
const CUT_STATUSES: ReadonlySet<string> = new Set(["cut", "wd", "dq"]);

/** Check if a player status is cut/withdrawn/disqualified */
export function isCutStatus(status: PlayerScore["status"]): boolean {
  return CUT_STATUSES.has(status);
}

/**
 * Get the Tailwind text color class for a pick's score.
 * - Cut/WD/DQ → red
 * - Under par → red (golf convention: red = good)
 * - Over par → blue
 * - Even → gray
 */
export function getScoreColor(scoreToPar: number, status?: PlayerScore["status"]): string {
  if (status && isCutStatus(status)) return "text-red-700";
  if (scoreToPar < 0) return "text-red-600";
  if (scoreToPar > 0) return "text-blue-600";
  return "text-gray-500";
}

/**
 * Get the Tailwind text color class for a total score (no status).
 */
export function getTotalScoreColor(totalScore: number): string {
  if (totalScore < 0) return "text-red-600";
  if (totalScore > 0) return "text-blue-600";
  return "text-gray-500";
}
