import { PICK_SLOT_DEFS } from "@/lib/constants";
import { calculateEffectiveScore, formatScoreToPar } from "@/lib/espn";
import type { LeaderboardEntry, Party, Picks, PlayerScore } from "@/types";

export function buildLeaderboardEntries(
  party: Party,
  allPicks: Record<string, Picks>,
  usersInfo: Record<string, { displayName: string; photoURL?: string }>,
  scores: PlayerScore[],
  cutLine?: number | null,
): LeaderboardEntry[] {
  const scoreByIdMap = new Map<string, PlayerScore>();
  const scoreByNameMap = new Map<string, PlayerScore>();

  scores.forEach((score) => {
    scoreByIdMap.set(score.playerId, score);
    scoreByNameMap.set(score.playerName.toLowerCase(), score);
  });

  const findScore = (playerId: string, playerName: string): PlayerScore | undefined => {
    return scoreByIdMap.get(playerId) || scoreByNameMap.get(playerName.toLowerCase());
  };

  const entries = party.memberUids.map((uid) => {
    const picks = allPicks[uid];
    const userInfo = usersInfo[uid] || { displayName: "Unknown" };

    let totalScore = 0;
    const resolvedPicks = picks
      ? PICK_SLOT_DEFS.map(({ key, label }) => {
          const pick = picks[key];

          if (!pick?.playerId) {
            return {
              group: label,
              playerId: "",
              playerName: "Not picked",
              scoreToPar: 0,
              displayScore: "-",
              status: "playing" as const,
            };
          }

          const score = findScore(pick.playerId, pick.playerName || "");
          if (!score) {
            return {
              group: label,
              playerId: pick.playerId,
              playerName: pick.playerName || "Unknown",
              scoreToPar: 0,
              displayScore: "-",
              status: "playing" as const,
            };
          }

          const { effectiveScore, penalty } = calculateEffectiveScore(score, cutLine);
          totalScore += effectiveScore;

          const displayParts = [formatScoreToPar(effectiveScore)];
          if (penalty > 0) displayParts.push(`(+${penalty})`);

          return {
            group: label,
            playerId: pick.playerId,
            playerName: score.playerName,
            scoreToPar: effectiveScore,
            displayScore: displayParts.join(" "),
            status: score.status,
            headshot: score.headshot,
            displayThru: score.displayThru,
          };
        })
      : [];

    return {
      userName: userInfo.displayName,
      userPhotoURL: userInfo.photoURL,
      uid,
      picks: resolvedPicks,
      totalScore,
      displayTotal: formatScoreToPar(totalScore),
    };
  });

  entries.sort((a, b) => a.totalScore - b.totalScore);
  return entries;
}
