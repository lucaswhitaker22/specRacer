import { RaceState, ParticipantState, RaceEvent } from '../../../shared/types';
export interface RaceStateBackup {
    raceState: RaceState;
    timestamp: number;
    version: number;
}
export declare class RaceStateCache {
    private readonly RACE_STATE_PREFIX;
    private readonly RACE_BACKUP_PREFIX;
    private readonly PARTICIPANT_PREFIX;
    private readonly RACE_EVENTS_PREFIX;
    private readonly RACE_STATE_EXPIRY;
    private readonly BACKUP_EXPIRY;
    private readonly MAX_BACKUPS;
    constructor();
    private getRaceStateKey;
    private getRaceBackupKey;
    private getParticipantKey;
    private getRaceEventsKey;
    cacheRaceState(raceState: RaceState): Promise<boolean>;
    getRaceState(raceId: string): Promise<RaceState | null>;
    updateParticipant(raceId: string, participant: ParticipantState): Promise<boolean>;
    getParticipant(raceId: string, playerId: string): Promise<ParticipantState | null>;
    addRaceEvent(raceId: string, event: RaceEvent): Promise<boolean>;
    getRaceEvents(raceId: string): Promise<RaceEvent[]>;
    createBackup(raceState: RaceState): Promise<boolean>;
    restoreFromBackup(raceId: string, version?: number): Promise<RaceState | null>;
    getAvailableBackups(raceId: string): Promise<RaceStateBackup[]>;
    removeRace(raceId: string): Promise<boolean>;
    getCacheStats(): Promise<{
        activeRaces: number;
        totalParticipants: number;
        totalBackups: number;
    }>;
}
//# sourceMappingURL=RaceStateCache.d.ts.map