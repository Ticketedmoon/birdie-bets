import type { User } from "firebase/auth";
import { PICK_LABELS } from "@/lib/constants";
import { calculatePayouts } from "@/lib/payouts";
import { getTotalScoreColor, isCutStatus } from "@/lib/scoring";
import type { LeaderboardEntry, Party } from "@/types";
import { PickCell } from "./PickCell";

interface LeaderboardCardsProps {
  leaderboard: LeaderboardEntry[];
  party: Party;
  user: User | null;
  picksRevealed: boolean;
  onSendUnlock: (targetUid: string) => void;
  unlockSending: Record<string, boolean>;
  unlockResult: Record<string, string>;
}

export function LeaderboardCards({
  leaderboard,
  party,
  user,
  picksRevealed,
  onSendUnlock,
  unlockSending,
  unlockResult,
}: LeaderboardCardsProps) {
  const payouts = party.buyIn > 0 ? calculatePayouts(party) : null;

  return (
    <>
      {leaderboard.map((entry, idx) => {
        const isOwnRow = entry.uid === user?.uid;
        const showPicks = picksRevealed || isOwnRow;
        const hasSubmitted = entry.picks.some((pick) => pick.playerId);

        return (
          <div
            key={entry.uid}
            className={`overflow-hidden rounded-xl border-2 ${
              isOwnRow ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-2.5 border-b border-gray-100 px-3.5 py-2.5">
              <span className="w-6 shrink-0 text-center text-sm font-bold text-gray-400">
                {idx === 0 ? "🏆" : idx === 1 && party.secondPlacePayout ? "🥈" : idx === 2 && party.thirdPlacePayout ? "🥉" : idx + 1}
              </span>
              {entry.userPhotoURL && (
                <img src={entry.userPhotoURL} alt="" className="h-7 w-7 shrink-0 rounded-full" referrerPolicy="no-referrer" />
              )}
              <div className="min-w-0 flex-1">
                <span className="truncate text-sm font-semibold text-gray-900">
                  {entry.userName}
                  {isOwnRow && <span className="ml-1 text-xs text-green-600">(you)</span>}
                </span>
                {!showPicks && (
                  <span className={`ml-2 text-xs ${hasSubmitted ? "text-green-600" : "text-gray-400"}`}>
                    {hasSubmitted ? "✓ Submitted" : "Waiting..."}
                  </span>
                )}
                {!isOwnRow && !hasSubmitted && user?.uid === party.createdBy && party.status === "locked" && (
                  <div className="ml-2 flex items-center gap-1.5">
                    <button
                      onClick={() => onSendUnlock(entry.uid)}
                      disabled={unlockSending[entry.uid]}
                      className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-200 disabled:opacity-50"
                    >
                      {unlockSending[entry.uid] ? "Sending..." : "📧 Send unlock"}
                    </button>
                    {unlockResult[entry.uid] && <span className="text-[10px]">{unlockResult[entry.uid]}</span>}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {showPicks ? (
                  <span className={`text-lg font-bold ${getTotalScoreColor(entry.totalScore)}`}>{entry.displayTotal}</span>
                ) : (
                  <span className="text-lg text-gray-300">🔒</span>
                )}
              </div>
            </div>

            {showPicks && (
              <div className="divide-y divide-gray-100">
                {entry.picks.map((pick, pickIdx) => {
                  const isCut = isCutStatus(pick.status);
                  return (
                    <div key={pickIdx} className={`px-3.5 py-2 ${isCut ? "bg-red-50" : ""}`}>
                      <PickCell pick={pick} label={PICK_LABELS[pickIdx]} variant="card" />
                    </div>
                  );
                })}
              </div>
            )}

            {showPicks && payouts && (
              <div className="border-t border-gray-100 px-3.5 py-1.5">
                {idx === 0 && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    Wins €{payouts.first}
                  </span>
                )}
                {idx === 1 && party.secondPlacePayout && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                    2nd — €{payouts.second}
                  </span>
                )}
                {idx === 2 && party.thirdPlacePayout && (
                  <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-600">
                    3rd — €{payouts.third}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
