// TypeScript types for the Golf Tourney Player Bet Tracker

export interface Player {
  id: string;
  displayName: string;
  shortName: string;
  lastName: string;
  headshot?: string;
  flagUrl?: string;
  country?: string;
  amateur: boolean;
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  scoreToPar: number;
  displayScore: string;
  status: "playing" | "finished" | "cut" | "wd" | "dq";
  position?: string;
  roundScores?: string[];
  headshot?: string;
  flagUrl?: string;
}

export type PlayerGroup = "A" | "B" | "C" | "D";

export interface GroupedPlayers {
  A: Player[];
  B: Player[];
  C: Player[];
  D: Player[];
}

export interface PlayerPick {
  playerId: string;
  playerName: string;
}

export interface Picks {
  groupA: PlayerPick | null;
  groupB: PlayerPick | null;
  groupC: PlayerPick | null;
  groupD: PlayerPick | null;
  wildcard1: PlayerPick | null;
  wildcard2: PlayerPick | null;
  lockedAt?: string;
}

export interface Party {
  id: string;
  name: string;
  createdBy: string;
  inviteCode: string;
  tournamentId: string;
  tournamentName: string;
  tournamentStartDate: string;
  createdAt: string;
  status: "picking" | "locked" | "complete";
  memberUids: string[];
  buyIn: number; // e.g. 10, 20, 30
  currency: string; // e.g. "EUR"
  secondPlacePayout: boolean; // if true, 2nd gets buyIn × 2
}

export interface PartyInvite {
  email: string;
  status: "pending" | "accepted";
  invitedBy: string;
}

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  courseName: string;
  purse?: string;
  status: "pre" | "in" | "post";
  isMajor: boolean;
}

export interface LeaderboardEntry {
  userName: string;
  userPhotoURL?: string;
  uid: string;
  picks: {
    group: string;
    playerId: string;
    playerName: string;
    scoreToPar: number;
    displayScore: string;
    status: "playing" | "finished" | "cut" | "wd" | "dq";
    headshot?: string;
  }[];
  totalScore: number;
  displayTotal: string;
}

export interface ESPNEvent {
  id: string;
  name: string;
  date: string;
  endDate: string;
  status: {
    type: {
      state: string;
      completed: boolean;
    };
  };
  tournament: {
    displayName: string;
    major: boolean;
  };
  courses: {
    name: string;
  }[];
  competitions: ESPNCompetition[];
  purse?: number;
  displayPurse?: string;
}

export interface ESPNCompetition {
  competitors: ESPNCompetitor[];
}

export interface ESPNCompetitor {
  id: string;
  status: {
    type: {
      name: string;
      state: string;
    };
    position?: {
      displayName: string;
    };
    thru?: number;
    displayThru?: string;
  };
  score: {
    displayValue: string;
  };
  statistics: {
    name: string;
    value?: number;
    displayValue?: string;
  }[];
  linescores?: {
    displayValue: string;
    period: number;
  }[];
  athlete: {
    id: string;
    displayName: string;
    shortName: string;
    lastName: string;
    amateur: boolean;
    headshot?: {
      href: string;
    };
    flag?: {
      href: string;
      alt: string;
    };
  };
}
