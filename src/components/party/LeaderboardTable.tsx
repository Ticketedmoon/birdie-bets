import type { User } from "firebase/auth";
import { PICK_LABELS } from "@/lib/constants";
import { calculatePayouts } from "@/lib/payouts";
import { getTotalScoreColor, isCutStatus } from "@/lib/scoring";
import type { LeaderboardEntry, Party } from "@/types";
import { PickCell } from "./PickCell";

interface LeaderboardTableProps {
  leaderboard: LeaderboardEntry[];
  party: Party;
  user: User | null;
  picksRevealed: boolean;
  onSendUnlock: (targetUid: string) => void;
  unlockSending: Record<string, boolean>;
  unlockResult: Record<string, string>;
  mobileView: "cards" | "table";
}

export function LeaderboardTable({
  leaderboard,
  party,
  user,
  picksRevealed,
  onSendUnlock,
  unlockSending,
  unlockResult,
  mobileView,
}: LeaderboardTableProps) {
  const payouts = party.buyIn > 0 ? calculatePayouts(party) : null;

  return (
    <div className={`relative -mx-2 rounded-xl border border-gray-200 sm:mx-0 ${mobileView === "table" ? "sm:block" : "hidden sm:block"}`}>
      {/* Scroll shadow on right edge (mobile hint) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-5 bg-gradient-to-l from-gray-300/50 to-transparent sm:hidden" />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm sm:min-w-[880px]">
          <thead>
            <tr className="bg-green-800 text-white">
              {/* Sticky rank + player header (single cell avoids jitter) */}
              <th className="sticky left-0 z-10 bg-green-800 whitespace-nowrap px-2 py-2 text-left text-xs font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] sm:px-4 sm:py-3 sm:text-sm sm:shadow-none">
                Player
              </th>
              <th className="whitespace-nowrap px-1.5 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                <span className="sm:hidden">A</span><span className="hidden sm:inline">Group A</span>
              </th>
              <th className="whitespace-nowrap px-1.5 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                <span className="sm:hidden">B</span><span className="hidden sm:inline">Group B</span>
              </th>
              <th className="whitespace-nowrap px-1.5 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                <span className="sm:hidden">C</span><span className="hidden sm:inline">Group C</span>
              </th>
              <th className="whitespace-nowrap px-1.5 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                <span className="sm:hidden">D</span><span className="hidden sm:inline">Group D</span>
              </th>
              <th className="whitespace-nowrap px-1.5 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                <span className="sm:hidden">W1</span><span className="hidden sm:inline">Wild 1</span>
              </th>
              <th className="whitespace-nowrap px-1.5 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                <span className="sm:hidden">W2</span><span className="hidden sm:inline">Wild 2</span>
              </th>
              <th className="whitespace-nowrap px-1.5 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Total</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, idx) => {
              const isOwnRow = entry.uid === user?.uid;
              const showPicks = picksRevealed || isOwnRow;
              const hasSubmitted = entry.picks.some((pick) => pick.playerId);
              const rowBg = isOwnRow ? "bg-green-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50";

              return (
                <tr
                  key={entry.uid}
                  className={`border-b border-gray-100 ${rowBg}`}
                >
                  {/* Sticky rank + player cell */}
                  <td className={`sticky left-0 z-10 ${rowBg} px-2 py-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3 sm:shadow-none`}>
                    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                      <span className="w-5 shrink-0 text-sm font-bold text-gray-500 sm:w-6">
                        {idx === 0 ? "🏆" : idx === 1 && party.secondPlacePayout ? "🥈" : idx === 2 && party.thirdPlacePayout ? "🥉" : idx + 1}
                      </span>
                      {entry.userPhotoURL && (
                        <img
                          src={entry.userPhotoURL}
                          alt=""
                          className="h-5 w-5 shrink-0 rounded-full sm:h-6 sm:w-6"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span className="min-w-0 max-w-[72px] truncate text-xs font-medium text-gray-900 sm:max-w-none sm:text-sm">
                        {entry.userName}
                        {isOwnRow && <span className="ml-1 text-xs text-green-600">(you)</span>}
                      </span>
                      {picksRevealed && payouts && idx === 0 && (
                        <span className="hidden shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 sm:inline">
                          +€{payouts.first}
                        </span>
                      )}
                      {picksRevealed && payouts && idx === 1 && party.secondPlacePayout && (
                        <span className="hidden shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 sm:inline">
                          +€{payouts.second}
                        </span>
                      )}
                      {picksRevealed && payouts && idx === 2 && party.thirdPlacePayout && (
                        <span className="hidden shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600 sm:inline">
                          +€{payouts.third}
                        </span>
                      )}
                      {!showPicks && (
                        <span className={`ml-1 whitespace-nowrap text-xs ${hasSubmitted ? "text-green-600" : "text-gray-400"}`}>
                          <span className="sm:hidden">{hasSubmitted ? "✓" : "…"}</span>
                          <span className="hidden sm:inline">{hasSubmitted ? "✓ Picks submitted" : "Waiting..."}</span>
                        </span>
                      )}
                      {!isOwnRow && !hasSubmitted && user?.uid === party.createdBy && party.status === "locked" && (
                        <div className="ml-1 hidden items-center gap-1 sm:inline-flex">
                          <button
                            onClick={() => onSendUnlock(entry.uid)}
                            disabled={unlockSending[entry.uid]}
                            className="inline-flex shrink-0 items-center rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 transition-colors hover:bg-purple-200 disabled:opacity-50"
                          >
                            {unlockSending[entry.uid] ? "Sending..." : "📧 Send unlock"}
                          </button>
                          {unlockResult[entry.uid] && (
                            <span className="whitespace-nowrap text-[10px]">{unlockResult[entry.uid]}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  {entry.picks.map((pick, pickIdx) => {
                    if (!showPicks) {
                      return (
                        <td key={pickIdx} className="px-1.5 py-2 text-center sm:px-4 sm:py-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm text-gray-300 sm:text-lg">🔒</span>
                          </div>
                        </td>
                      );
                    }

                    const isCut = isCutStatus(pick.status);
                    return (
                      <td
                        key={pickIdx}
                        className={`px-1.5 py-2 text-center sm:px-4 sm:py-3 ${isCut ? "border-l-2 border-red-400 bg-red-100" : ""}`}
                        title={isCut ? `${pick.playerName} — Missed Cut (+1 penalty)` : pick.playerName}
                      >
                        <PickCell pick={pick} label={PICK_LABELS[pickIdx]} variant="table" />
                      </td>
                    );
                  })}
                  <td className="px-1.5 py-2 text-center sm:px-4 sm:py-3">
                    {showPicks ? (
                      <span className={`text-sm font-bold sm:text-lg ${getTotalScoreColor(entry.totalScore)}`}>
                        {entry.displayTotal}
                      </span>
                    ) : (
                      <span className="text-lg text-gray-300">🔒</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
