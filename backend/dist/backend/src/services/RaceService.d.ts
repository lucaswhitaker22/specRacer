import { EventEmitter } from 'events';
import { ProcessedCommand } from '../engine/CommandProcessor';
import { RaceState, RaceEvent, WeatherConditions, TrackConditions } from '../../../shared/types';
export interface RaceResult {
    raceId: string;
    trackId: string;
    startTime: Date;
    endTime: Date;
    totalLaps: number;
    participants: RaceParticipantResult[];
    raceEvents: RaceEvent[];
    weather: WeatherConditions;
    trackConditions: TrackConditions;
}
export interface RaceParticipantResult {
    playerId: string;
    carId: string;
    finalPosition: number;
    finalTime: number;
    lapTimes: number[];
    bestLapTime: number;
    totalDistance: number;
    averageSpeed: number;
    fuelUsed: number;
    tireChanges: number;
    pitStops: PitStopRecord[];
}
export interface PitStopRecord {
    lap: number;
    timestamp: number;
    duration: number;
    actions: PitStopAction[];
}
export interface PitStopAction {
    type: 'tire_change' | 'refuel' | 'repair';
    details: any;
    timeCost: number;
}
export interface CreateRaceOptions {
    trackId: string;
    totalLaps: number;
    maxParticipants?: number;
    weather?: WeatherConditions;
    trackConditions?: TrackConditions;
}
export interface JoinRaceOptions {
    playerId: string;
    carId: string;
}
export declare class RaceService extends EventEmitter {
    private activeRaces;
    private raceConfigurations;
    private commandProcessors;
    private pitStopStates;
    private raceResults;
    private trackConfigurations;
    constructor();
    private initializeDefaultTrack;
    createRace(options: CreateRaceOptions): Promise<string>;
    joinRace(raceId: string, options: JoinRaceOptions): Promise<boolean>;
    leaveRace(raceId: string, playerId: string): Promise<boolean>;
    startRace(raceId: string): Promise<boolean>;
    processPlayerCommand(raceId: string, playerId: string, commandText: string): Promise<ProcessedCommand>;
    getRaceState(raceId: string): RaceState | null;
    getRaceResult(raceId: string): RaceResult | null;
    getActiveRaces(): string[];
    private handlePitStopCommand;
    private determinePitStopActions;
    private applyPitStopEffects;
    private calculateRaceResults;
    private cleanupRace;
    private persistRaceCreation;
    private persistRaceParticipant;
    private updateRaceStatus;
    private persistRaceResults;
    private updatePlayerStatistics;
    private generateRaceId;
    private validateCarSelection;
    private getDefaultWeather;
    private getDefaultTrackConditions;
    private getPitStopsForPlayer;
    private calculateAverageSpeed;
    private calculateLeaguePoints;
    getAvailableRaces(): Promise<any[]>;
    getRaceResults(raceId: string): Promise<RaceResult | null>;
}
//# sourceMappingURL=RaceService.d.ts.map