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
    <div className={`-mx-4 overflow-x-auto rounded-xl border border-gray-200 sm:mx-0 ${mobileView === "table" ? "sm:block" : "hidden sm:block"}`}>
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="bg-green-800 text-white">
            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">#</th>
            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Player</th>
            <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Group A</th>
            <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Group B</th>
            <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Group C</th>
            <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Group D</th>
            <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Wild 1</th>
            <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Wild 2</th>
            <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">Total</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry, idx) => {
            const isOwnRow = entry.uid === user?.uid;
            const showPicks = picksRevealed || isOwnRow;
            const hasSubmitted = entry.picks.some((pick) => pick.playerId);

            return (
              <tr
                key={entry.uid}
                className={`border-b border-gray-100 ${
                  isOwnRow ? "bg-green-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
              >
                <td className="px-2 py-2 text-sm font-bold text-gray-500 sm:px-4 sm:py-3">
                  {idx === 0 ? "🏆" : idx === 1 && party.secondPlacePayout ? "🥈" : idx === 2 && party.thirdPlacePayout ? "🥉" : idx + 1}
                </td>
                <td className="px-2 py-2 sm:px-4 sm:py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {entry.userPhotoURL && (
                      <img
                        src={entry.userPhotoURL}
                        alt=""
                        className="h-6 w-6 shrink-0 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span className="min-w-0 truncate font-medium text-gray-900">
                      {entry.userName}
                      {isOwnRow && <span className="ml-1 text-xs text-green-600">(you)</span>}
                    </span>
                    {picksRevealed && payouts && idx === 0 && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        +€{payouts.first}
                      </span>
                    )}
                    {picksRevealed && payouts && idx === 1 && party.secondPlacePayout && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                        +€{payouts.second}
                      </span>
                    )}
                    {picksRevealed && payouts && idx === 2 && party.thirdPlacePayout && (
                      <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                        +€{payouts.third}
                      </span>
                    )}
                    {!showPicks && (
                      <span className={`ml-1 whitespace-nowrap text-xs ${hasSubmitted ? "text-green-600" : "text-gray-400"}`}>
                        {hasSubmitted ? "✓ Picks submitted" : "Waiting..."}
                      </span>
                    )}
                    {!isOwnRow && !hasSubmitted && user?.uid === party.createdBy && party.status === "locked" && (
                      <div className="ml-1 inline-flex items-center gap-1">
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
                      <td key={pickIdx} className="px-2 py-2 text-center sm:px-4 sm:py-3">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-base text-gray-300 sm:text-lg">🔒</span>
                          <span className="text-[10px] text-gray-400">Hidden</span>
                        </div>
                      </td>
                    );
                  }

                  const isCut = isCutStatus(pick.status);
                  return (
                    <td
                      key={pickIdx}
                      className={`px-2 py-2 text-center sm:px-4 sm:py-3 ${isCut ? "border-l-2 border-red-400 bg-red-100" : ""}`}
                      title={isCut ? `${pick.playerName} — Missed Cut (+1 penalty)` : pick.playerName}
                    >
                      <PickCell pick={pick} label={PICK_LABELS[pickIdx]} variant="table" />
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center sm:px-4 sm:py-3">
                  {showPicks ? (
                    <span className={`text-base font-bold sm:text-lg ${getTotalScoreColor(entry.totalScore)}`}>
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
  );
}
