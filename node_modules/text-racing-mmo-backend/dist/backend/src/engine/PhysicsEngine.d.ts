import { RaceState, ParticipantState, RaceEvent } from '../../../shared/types';
export interface PhysicsUpdate {
    participantId: string;
    newState: ParticipantState;
    events: RaceEvent[];
}
export interface RaceCommand {
    type: 'accelerate' | 'brake' | 'coast' | 'shift' | 'pit';
    intensity?: number;
    gear?: number;
}
export interface TrackConfiguration {
    id: string;
    name: string;
    length: number;
    sectors: number;
    corners: number;
    elevation: number;
    surface: 'asphalt' | 'concrete';
    difficulty: number;
}
export declare class PhysicsEngine {
    private static readonly TICK_RATE;
    private static readonly TICK_DURATION;
    private static readonly DEFAULT_TRACK;
    static processRaceTick(raceState: RaceState, commands: Map<string, RaceCommand>, track?: TrackConfiguration): {
        updatedState: RaceState;
        events: RaceEvent[];
    };
    private static updateParticipant;
    private static processCommand;
    private static calculateDragDeceleration;
    private static calculateLateralG;
    private static detectOvertakes;
    private static detectLapCompletions;
    private static createRaceEvent;
    static getDefaultTrack(): TrackConfiguration;
    static getTickRate(): number;
    static getTickDuration(): number;
}
//# sourceMappingURL=PhysicsEngine.d.ts.map