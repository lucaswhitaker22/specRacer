"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionService = void 0;
const redis_1 = require("../database/redis");
class SessionService {
    constructor() {
        this.SESSION_PREFIX = 'session:';
        this.PLAYER_SESSION_PREFIX = 'player_session:';
        this.SESSION_EXPIRY = 24 * 60 * 60;
    }
    getSessionKey(sessionId) {
        return `${this.SESSION_PREFIX}${sessionId}`;
    }
    getPlayerSessionKey(playerId) {
        return `${this.PLAYER_SESSION_PREFIX}${playerId}`;
    }
    async createSession(playerId, username, connectionId) {
        const sessionId = `${playerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session = {
            playerId,
            username,
            connectionId,
            lastActivity: Date.now(),
            isActive: true
        };
        const client = redis_1.redisManager.getClient();
        await client.setEx(this.getSessionKey(sessionId), this.SESSION_EXPIRY, JSON.stringify(session));
        await client.setEx(this.getPlayerSessionKey(playerId), this.SESSION_EXPIRY, sessionId);
        return sessionId;
    }
    async getSession(sessionId) {
        try {
            const client = redis_1.redisManager.getClient();
            const sessionData = await client.get(this.getSessionKey(sessionId));
            if (!sessionData) {
                return null;
            }
            return JSON.parse(sessionData);
        }
        catch (error) {
            console.error('Error getting session:', error);
            return null;
        }
    }
    async getPlayerSession(playerId) {
        try {
            const client = redis_1.redisManager.getClient();
            const sessionId = await client.get(this.getPlayerSessionKey(playerId));
            if (!sessionId) {
                return null;
            }
            return this.getSession(sessionId);
        }
        catch (error) {
            console.error('Error getting player session:', error);
            return null;
        }
    }
    async updateSessionActivity(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return false;
            }
            session.lastActivity = Date.now();
            const client = redis_1.redisManager.getClient();
            await client.setEx(this.getSessionKey(sessionId), this.SESSION_EXPIRY, JSON.stringify(session));
            return true;
        }
        catch (error) {
            console.error('Error updating session activity:', error);
            return false;
        }
    }
    async updatePlayerRace(playerId, raceId) {
        try {
            const session = await this.getPlayerSession(playerId);
            if (!session) {
                return false;
            }
            session.currentRaceId = raceId || undefined;
            session.lastActivity = Date.now();
            const client = redis_1.redisManager.getClient();
            const sessionId = await client.get(this.getPlayerSessionKey(playerId));
            if (!sessionId) {
                return false;
            }
            await client.setEx(this.getSessionKey(sessionId), this.SESSION_EXPIRY, JSON.stringify(session));
            return true;
        }
        catch (error) {
            console.error('Error updating player race:', error);
            return false;
        }
    }
    async updateConnectionId(playerId, newConnectionId) {
        try {
            const session = await this.getPlayerSession(playerId);
            if (!session) {
                return false;
            }
            session.connectionId = newConnectionId;
            session.lastActivity = Date.now();
            const client = redis_1.redisManager.getClient();
            const sessionId = await client.get(this.getPlayerSessionKey(playerId));
            if (!sessionId) {
                return false;
            }
            await client.setEx(this.getSessionKey(sessionId), this.SESSION_EXPIRY, JSON.stringify(session));
            return true;
        }
        catch (error) {
            console.error('Error updating connection ID:', error);
            return false;
        }
    }
    async deactivateSession(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return false;
            }
            session.isActive = false;
            session.lastActivity = Date.now();
            const client = redis_1.redisManager.getClient();
            await client.setEx(this.getSessionKey(sessionId), this.SESSION_EXPIRY, JSON.stringify(session));
            return true;
        }
        catch (error) {
            console.error('Error deactivating session:', error);
            return false;
        }
    }
    async removeSession(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return false;
            }
            const client = redis_1.redisManager.getClient();
            await client.del([
                this.getSessionKey(sessionId),
                this.getPlayerSessionKey(session.playerId)
            ]);
            return true;
        }
        catch (error) {
            console.error('Error removing session:', error);
            return false;
        }
    }
    async getActiveSessions() {
        try {
            const client = redis_1.redisManager.getClient();
            const sessionKeys = await client.keys(`${this.SESSION_PREFIX}*`);
            const sessions = [];
            for (const key of sessionKeys) {
                const sessionData = await client.get(key);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    if (session.isActive) {
                        sessions.push(session);
                    }
                }
            }
            return sessions;
        }
        catch (error) {
            console.error('Error getting active sessions:', error);
            return [];
        }
    }
    async cleanupExpiredSessions() {
        try {
            const client = redis_1.redisManager.getClient();
            const sessionKeys = await client.keys(`${this.SESSION_PREFIX}*`);
            let cleanedCount = 0;
            const expiredThreshold = Date.now() - (this.SESSION_EXPIRY * 1000);
            for (const key of sessionKeys) {
                const sessionData = await client.get(key);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    if (session.lastActivity < expiredThreshold) {
                        await this.removeSession(key.replace(this.SESSION_PREFIX, ''));
                        cleanedCount++;
                    }
                }
            }
            return cleanedCount;
        }
        catch (error) {
            console.error('Error cleaning up expired sessions:', error);
            return 0;
        }
    }
}
exports.SessionService = SessionService;
//# sourceMappingURL=SessionService.js.map