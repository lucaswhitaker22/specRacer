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
    weight: number;
    dragCoefficient: number;
    frontalArea: number;
    drivetrain: 'FWD' | 'RWD' | 'AWD';
    tireGrip: number;
    gearRatios: number[];
    aeroDownforce: number;
    fuelEconomy: number;
    zeroToSixty: number;
    topSpeed: number;
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
    raceTime: number;
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
    fuel: number;
    tireWear: TireWear;
    speed: number;
    location: TrackPosition;
    lastCommand: string;
    commandTimestamp: number;
}
export interface TireWear {
    front: number;
    rear: number;
}
export interface TrackPosition {
    lap: number;
    sector: number;
    distance: number;
}
export interface RaceEvent {
    id: string;
    timestamp: number;
    type: RaceEventType;
    description: string;
    involvedPlayers: string[];
    data?: any;
}
export type RaceEventType = 'overtake' | 'pit_stop' | 'incident' | 'lap_complete' | 'race_start' | 'race_finish';
export interface WeatherConditions {
    temperature: number;
    humidity: number;
    windSpeed: number;
    precipitation: number;
    visibility: number;
}
export interface TrackConditions {
    surface: 'dry' | 'wet' | 'damp';
    grip: number;
    temperature: number;
}
//# sourceMappingURL=index.d.ts.map