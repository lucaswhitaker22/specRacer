import { SessionService } from './SessionService';
import { RaceStateCache } from './RaceStateCache';
export declare class RedisService {
    private sessionService;
    private raceStateCache;
    constructor();
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    healthCheck(): Promise<{
        redis: boolean;
        services: boolean;
        stats: any;
    }>;
    getSessionService(): SessionService;
    getRaceStateCache(): RaceStateCache;
    private startCleanupInterval;
    emergencyRecovery(): Promise<{
        success: boolean;
        message: string;
        recoveredRaces: string[];
    }>;
    clearAllCache(): Promise<boolean>;
    getSystemStats(): Promise<{
        redis: {
            connected: boolean;
            memory: any;
            keyspace: any;
        };
        cache: {
            activeRaces: number;
            totalParticipants: number;
            totalBackups: number;
        };
        sessions: {
            activeSessions: number;
        };
    }>;
    get(key: string): Promise<string | null>;
    setWithExpiry(key: string, value: string, expiry: number): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    listPush(key: string, value: string): Promise<number>;
    listRange(key: string, start: number, stop: number): Promise<string[]>;
    listLength(key: string): Promise<number>;
    listTrim(key: string, start: number, stop: number): Promise<boolean>;
    getKeys(pattern: string): Promise<string[]>;
    getRaceState(raceId: string): Promise<any>;
    setRaceState(raceId: string, raceState: any): Promise<boolean>;
}
export declare const redisService: RedisService;
//# sourceMappingURL=RedisService.d.ts.map