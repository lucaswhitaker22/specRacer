// Player and authentication related interfaces

export interface Player {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  totalRaces: number;
  wins: number;
  leaguePoints: number;
  currentCarId?: string;
}

export interface PlayerProfile extends Player {
  raceHistory: RaceResult[];
  statistics: PlayerStatistics;
}

export interface PlayerStatistics {
  averageLapTime: number;
  bestLapTime: number;
  totalRaceTime: number;
  podiumFinishes: number;
  dnfCount: number;
  averagePosition: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  email: string;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  playerId: string;
}

export interface RaceResult {
  raceId: string;
  playerId: string;
  carId: string;
  finalPosition: number;
  finalTime: number;
  lapTimes: number[];
  raceEvents: string[]; // Event IDs
  points: number;
  completedAt: Date;
}