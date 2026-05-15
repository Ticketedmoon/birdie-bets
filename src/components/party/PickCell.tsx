import { getScoreColor, isCutStatus } from "@/lib/scoring";
import type { LeaderboardEntry } from "@/types";

type Pick = LeaderboardEntry["picks"][number];

interface PickCellProps {
  pick: Pick;
  label: string;
  variant: "card" | "table";
}

export function PickCell({ pick, label, variant }: PickCellProps) {
  const isCut = isCutStatus(pick.status);
  const scoreColor = getScoreColor(pick.scoreToPar, pick.status);
  const nameColor = isCut ? "text-red-700 line-through" : variant === "card" ? "text-gray-700" : "text-gray-600";

  if (variant === "card") {
    return (
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-center text-[11px] font-bold text-gray-400">{label}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${nameColor}`}>{pick.playerName}</span>
        {!isCut && pick.displayThru && pick.status === "playing" && (
          <span className="shrink-0 text-[10px] font-medium text-gray-400">Thru {pick.displayThru}</span>
        )}
        {!isCut && pick.status === "finished" && (
          <span className="shrink-0 text-[10px] font-medium text-green-600">F</span>
        )}
        <span className={`shrink-0 text-sm font-bold ${scoreColor}`}>{pick.displayScore}</span>
        {isCut && (
          <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">CUT</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`max-w-[52px] truncate text-[10px] sm:max-w-[100px] sm:text-xs ${nameColor}`}>{pick.playerName}</span>
      <span className={`text-xs font-bold sm:text-sm ${scoreColor}`}>{pick.displayScore}</span>
      {!isCut && pick.displayThru && pick.status === "playing" && (
        <span className="hidden text-[10px] font-medium text-gray-400 sm:inline">Thru {pick.displayThru}</span>
      )}
      {!isCut && pick.status === "finished" && (
        <span className="hidden text-[10px] font-medium text-green-600 sm:inline">F</span>
      )}
      {isCut && (
        <span className="rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold text-white sm:px-1.5 sm:text-[10px]">CUT</span>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
