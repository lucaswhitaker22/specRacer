// Core data model interfaces for Text Racing MMO

export interface CarModel {
  id: string;
  name: string;
  manufacturer: string;
  year: number;
  specifications: CarSpecifications;
  licensing: LicensingInfo;
}

export interface CarSpecifications {
  horsepower: number;
  weight: number; // kg
  dragCoefficient: number;
  frontalArea: number; // m²
  drivetrain: 'FWD' | 'RWD' | 'AWD';
  tireGrip: number; // coefficient
  gearRatios: number[];
  aeroDownforce: number; // kg at 100mph
  fuelEconomy: number; // L/100km
  zeroToSixty: number; // seconds
  topSpeed: number; // km/h
}

export interface LicensingInfo {
  source: string;
  validUntil: Date;
  restrictions: string[];
}

export interface RaceState {
  raceId: string;
  trackId: string;
  currentLap: number;
  totalLaps: number;
  raceTime: number; // seconds since start
  participants: ParticipantState[];
  raceEvents: RaceEvent[];
  weather: WeatherConditions;
  trackConditions: TrackConditions;
}

export interface ParticipantState {
  playerId: string;
  carId: string;
  position: number;
  lapTime: number;
  totalTime: number;
  fuel: number; // percentage
  tireWear: TireWear;
  speed: number; // km/h
  location: TrackPosition;
  lastCommand: string;
  commandTimestamp: number;
}

export interface TireWear {
  front: number; // percentage
  rear: number; // percentage
}

export interface TrackPosition {
  lap: number;
  sector: number;
  distance: number; // meters from start/finish line
}

export interface RaceEvent {
  id: string;
  timestamp: number;
  type: RaceEventType;
  description: string;
  involvedPlayers: string[];
  data?: any;
}

export type RaceEventType = 
  | 'overtake' 
  | 'pit_stop' 
  | 'incident' 
  | 'lap_complete' 
  | 'race_start' 
  | 'race_finish';

export interface WeatherConditions {
  temperature: number; // Celsius
  humidity: number; // percentage
  windSpeed: number; // km/h
  precipitation: number; // mm/h
  visibility: number; // meters
}

export interface TrackConditions {
  surface: 'dry' | 'wet' | 'damp';
  grip: number; // coefficient
  temperature: number; // Celsius
}