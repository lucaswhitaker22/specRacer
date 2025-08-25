import { RaceState } from '../../../shared/types';
export interface StateSnapshot {
    id: string;
    raceId: string;
    timestamp: number;
    raceState: RaceState;
    checksum: string;
}
export interface RecoveryResult {
    success: boolean;
    recoveredState?: RaceState;
    fallbackState?: RaceState;
    error?: string;
}
export declare class StateRecoveryService {
    private static instance;
    private readonly logger;
    private readonly snapshotInterval;
    private readonly maxSnapshots;
    private snapshotTimers;
    private constructor();
    static getInstance(): StateRecoveryService;
    startStateSnapshots(raceId: string): void;
    stopStateSnapshots(raceId: string): void;
    createStateSnapshot(raceId: string): Promise<string>;
    recoverRaceState(raceId: string): Promise<RecoveryResult>;
    rollbackToSnapshot(raceId: string, snapshotId: string): Promise<RecoveryResult>;
    getAvailableSnapshots(raceId: string): Promise<StateSnapshot[]>;
    cleanupRaceSnapshots(raceId: string): Promise<void>;
    private getSnapshot;
    private getSnapshotList;
    private trimOldSnapshots;
    private validateSnapshot;
    private calculateChecksum;
    private generateSnapshotId;
    private createFallbackState;
}
//# sourceMappingURL=StateRecoveryService.d.ts.map