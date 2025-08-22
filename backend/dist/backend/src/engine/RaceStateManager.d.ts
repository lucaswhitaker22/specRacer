import { RaceState, RaceEvent, WeatherConditions, TrackConditions } from '../../../shared/types';
import { RaceCommand, TrackConfiguration } from './PhysicsEngine';
export interface RaceConfiguration {
    raceId: string;
    trackId: string;
    totalLaps: number;
    maxParticipants: number;
    weather: WeatherConditions;
    trackConditions: TrackConditions;
}
export declare class RaceStateManager {
    private raceState;
    private isActive;
    private tickInterval;
    private commandQueue;
    private track;
    constructor(config: RaceConfiguration, track?: TrackConfiguration);
    private initializeRaceState;
    addParticipant(playerId: string, carId: string): boolean;
    removeParticipant(playerId: string): boolean;
    startRace(): boolean;
    stopRace(): void;
    queueCommand(playerId: string, command: RaceCommand): boolean;
    private processTick;
    private checkRaceCompletion;
    protected onRaceEvents(events: RaceEvent[]): void;
    getRaceState(): RaceState;
    isRaceActive(): boolean;
    getParticipantCount(): number;
    getRaceProgress(): number;
    getTrack(): TrackConfiguration;
    updateWeather(weather: WeatherConditions): void;
    updateTrackConditions(conditions: TrackConditions): void;
}
//# sourceMappingURL=RaceStateManager.d.ts.map