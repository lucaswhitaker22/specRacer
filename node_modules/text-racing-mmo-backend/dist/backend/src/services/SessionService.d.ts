export interface PlayerSession {
    playerId: string;
    username: string;
    currentRaceId?: string;
    connectionId: string;
    lastActivity: number;
    isActive: boolean;
}
export declare class SessionService {
    private readonly SESSION_PREFIX;
    private readonly PLAYER_SESSION_PREFIX;
    private readonly SESSION_EXPIRY;
    constructor();
    private getSessionKey;
    private getPlayerSessionKey;
    createSession(playerId: string, username: string, connectionId: string): Promise<string>;
    getSession(sessionId: string): Promise<PlayerSession | null>;
    getPlayerSession(playerId: string): Promise<PlayerSession | null>;
    updateSessionActivity(sessionId: string): Promise<boolean>;
    updatePlayerRace(playerId: string, raceId: string | null): Promise<boolean>;
    updateConnectionId(playerId: string, newConnectionId: string): Promise<boolean>;
    deactivateSession(sessionId: string): Promise<boolean>;
    removeSession(sessionId: string): Promise<boolean>;
    getActiveSessions(): Promise<PlayerSession[]>;
    cleanupExpiredSessions(): Promise<number>;
}
//# sourceMappingURL=SessionService.d.ts.map