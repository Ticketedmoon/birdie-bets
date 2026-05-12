import type { GroupedPlayers, Player } from "@/types";

/**
 * Player groups based on OWGR (Official World Golf Ranking).
 * Groups are frozen at config time. In a future version, these could be
 * fetched dynamically from the world ranking API.
 *
 * See ADR-004 for rationale.
 */

export const PLAYER_GROUPS: GroupedPlayers = {
  A: [
    { id: "9478", displayName: "Scottie Scheffler", shortName: "S. Scheffler", lastName: "Scheffler", amateur: false },
    { id: "3702", displayName: "Rory McIlroy", shortName: "R. McIlroy", lastName: "McIlroy", amateur: false },
    { id: "12997", displayName: "Cameron Young", shortName: "C. Young", lastName: "Young", amateur: false },
    { id: "10486", displayName: "Matt Fitzpatrick", shortName: "M. Fitzpatrick", lastName: "Fitzpatrick", amateur: false },
    { id: "10592", displayName: "Collin Morikawa", shortName: "C. Morikawa", lastName: "Morikawa", amateur: false },
    { id: "5765", displayName: "Tommy Fleetwood", shortName: "T. Fleetwood", lastName: "Fleetwood", amateur: false },
  ],
  B: [
    { id: "1225", displayName: "Justin Rose", shortName: "J. Rose", lastName: "Rose", amateur: false },
    { id: "10166", displayName: "J.J. Spaun", shortName: "J.J. Spaun", lastName: "Spaun", amateur: false },
    { id: "5409", displayName: "Russell Henley", shortName: "R. Henley", lastName: "Henley", amateur: false },
    { id: "11634", displayName: "Chris Gotterup", shortName: "C. Gotterup", lastName: "Gotterup", amateur: false },
    { id: "10140", displayName: "Xander Schauffele", shortName: "X. Schauffele", lastName: "Schauffele", amateur: false },
    { id: "12014", displayName: "Robert MacIntyre", shortName: "R. MacIntyre", lastName: "MacIntyre", amateur: false },
  ],
  C: [
    { id: "9997", displayName: "Sepp Straka", shortName: "S. Straka", lastName: "Straka", amateur: false },
    { id: "11498", displayName: "Ben Griffin", shortName: "B. Griffin", lastName: "Griffin", amateur: false },
    { id: "11885", displayName: "Ludvig Åberg", shortName: "L. Åberg", lastName: "Åberg", amateur: false },
    { id: "5323", displayName: "Justin Thomas", shortName: "J. Thomas", lastName: "Thomas", amateur: false },
    { id: "5860", displayName: "Hideki Matsuyama", shortName: "H. Matsuyama", lastName: "Matsuyama", amateur: false },
    { id: "3832", displayName: "Alex Noren", shortName: "A. Noren", lastName: "Noren", amateur: false },
  ],
  D: [
    { id: "11563", displayName: "Jacob Bridgeman", shortName: "J. Bridgeman", lastName: "Bridgeman", amateur: false },
    { id: "9780", displayName: "Jon Rahm", shortName: "J. Rahm", lastName: "Rahm", amateur: false },
    { id: "4848", displayName: "Harris English", shortName: "H. English", lastName: "English", amateur: false },
    { id: "8793", displayName: "Si Woo Kim", shortName: "S.W. Kim", lastName: "Kim", amateur: false },
    { id: "11119", displayName: "Akshay Bhatia", shortName: "A. Bhatia", lastName: "Bhatia", amateur: false },
    { id: "6298", displayName: "Patrick Reed", shortName: "P. Reed", lastName: "Reed", amateur: false },
  ],
};

export const GROUP_LABELS: Record<string, string> = {
  A: "Group A — Elite (Rank 1–6)",
  B: "Group B — Contenders (Rank 7–12)",
  C: "Group C — Rising Stars (Rank 13–18)",
  D: "Group D — Dark Horses (Rank 19–24)",
};

/** Get all player IDs that are in groups A–D (not eligible for wildcard) */
export function getGroupedPlayerIds(): Set<string> {
  const ids = new Set<string>();
  for (const group of Object.values(PLAYER_GROUPS)) {
    for (const player of group) {
      ids.add(player.id);
    }
  }
  return ids;
}

/** Check if a player is in groups A-D */
export function isInGroups(playerId: string): boolean {
  return getGroupedPlayerIds().has(playerId);
}
