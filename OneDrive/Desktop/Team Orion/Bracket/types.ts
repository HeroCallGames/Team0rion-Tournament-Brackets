export enum TournamentType {
  SINGLE_ELIMINATION = 'Single Elimination',
}

export enum MatchFormat {
  BEST_OF_1 = 'Best of 1',
  BEST_OF_3 = 'Best of 3',
  BEST_OF_5 = 'Best of 5',
  BEST_OF_7 = 'Best of 7',
}

export enum TournamentStatus {
  DRAFT = 'Draft',
  REGISTRATION_OPEN = 'Open for Registration',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  ARCHIVED = 'Archived',
}

export interface City {
  id: string;
  name: string;
  icon: string;
}

export interface Player {
  id:string;
  gamertag: string;
  discordOrIGN?: string;
  icon: string;
  seed: number;
  selfReportingPasswordHash: string;
}

export interface Match {
  id: string;
  roundIndex: number; // 0-based index of the round
  matchIndex: number; // 0-based index within the round
  players: (string | null)[]; // Player IDs
  scores: number[];
  winnerId?: string | null;
  isBye?: boolean;
  nextMatchId?: string | null;
  justCompleted?: boolean;
  isGrandFinals?: boolean;
}

export interface Bracket {
  winners: Match[][]; // rounds
}

export interface Tournament {
  id: string;
  name: string;
  gameTitle: string;
  platforms: string[];
  tournamentType: TournamentType;
  matchFormat: MatchFormat;
  startDate: string;
  endDate?: string;
  description: string;
  discordLink?: string;
  adminPasswordHash: string;
  logoUrl?: string;
  bannerUrl?: string;
  backgroundUrl: string;
  rules?: string;
  prizePool?: string;
  status: TournamentStatus;
  players: Player[];
  bracket?: Bracket;
  announcements: string;
  isCitiesTournament?: boolean;
}

export interface IconAsset {
  name: string;
  url: string;
}

export interface SuperAdminAssets {
  backgrounds: { [gameTitle: string]: string };
  icons: IconAsset[];
  cities: City[];
  popularGames: string[];
}