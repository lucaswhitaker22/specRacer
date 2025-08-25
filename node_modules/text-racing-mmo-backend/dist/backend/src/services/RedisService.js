"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisService = exports.RedisService = void 0;
const redis_1 = require("../database/redis");
const SessionService_1 = require("./SessionService");
const RaceStateCache_1 = require("./RaceStateCache");
class RedisService {
    constructor() {
        this.sessionService = new SessionService_1.SessionService();
        this.raceStateCache = new RaceStateCache_1.RaceStateCache();
    }
    async initialize() {
        try {
            await redis_1.redisManager.connect();
            console.log('Redis services initialized successfully');
            this.startCleanupInterval();
        }
        catch (error) {
            console.warn('Redis not available - running in degraded mode without caching:', error.message);
        }
    }
    async shutdown() {
        try {
            await redis_1.redisManager.disconnect();
            console.log('Redis services shut down successfully');
        }
        catch (error) {
            console.error('Error shutting down Redis services:', error);
        }
    }
    async healthCheck() {
        try {
            const redisHealth = await redis_1.redisManager.ping();
            const cacheStats = await this.raceStateCache.getCacheStats();
            const activeSessions = await this.sessionService.getActiveSessions();
            return {
                redis: redisHealth,
                services: true,
                stats: {
                    ...cacheStats,
                    activeSessions: activeSessions.length,
                    isConnected: redis_1.redisManager.isReady()
                }
            };
        }
        catch (error) {
            console.error('Redis health check failed:', error);
            return {
                redis: false,
                services: false,
                stats: null
            };
        }
    }
    getSessionService() {
        return this.sessionService;
    }
    getRaceStateCache() {
        return this.raceStateCache;
    }
    startCleanupInterval() {
        setInterval(async () => {
            try {
                const cleanedSessions = await this.sessionService.cleanupExpiredSessions();
                if (cleanedSessions > 0) {
                    console.log(`Cleaned up ${cleanedSessions} expired sessions`);
                }
            }
            catch (error) {
                console.error('Error during periodic cleanup:', error);
            }
        }, 15 * 60 * 1000);
    }
    async emergencyRecovery() {
        try {
            console.log('Starting emergency recovery...');
            const client = redis_1.redisManager.getClient();
            const backupKeys = await client.keys('race_backup:*');
            const raceIds = new Set();
            backupKeys.forEach(key => {
                const raceId = key.split(':')[1];
                if (raceId) {
                    raceIds.add(raceId);
                }
            });
            const recoveredRaces = [];
            for (const raceId of raceIds) {
                try {
                    const restoredState = await this.raceStateCache.restoreFromBackup(raceId);
                    if (restoredState) {
                        recoveredRaces.push(raceId);
                        console.log(`Recovered race ${raceId} from backup`);
                    }
                }
                catch (error) {
                    console.error(`Failed to recover race ${raceId}:`, error);
                }
            }
            const message = `Emergency recovery completed. Recovered ${recoveredRaces.length} races.`;
            console.log(message);
            return {
                success: true,
                message,
                recoveredRaces
            };
        }
        catch (error) {
            const message = `Emergency recovery failed: ${error}`;
            console.error(message);
            return {
                success: false,
                message,
                recoveredRaces: []
            };
        }
    }
    async clearAllCache() {
        try {
            const client = redis_1.redisManager.getClient();
            await client.flushDb();
            console.log('All Redis cache cleared');
            return true;
        }
        catch (error) {
            console.error('Error clearing cache:', error);
            return false;
        }
    }
    async getSystemStats() {
        try {
            const client = redis_1.redisManager.getClient();
            const [info, cacheStats, activeSessions] = await Promise.all([
                client.info(),
                this.raceStateCache.getCacheStats(),
                this.sessionService.getActiveSessions()
            ]);
            const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
            const keyspaceMatch = info.match(/db0:keys=(\d+),expires=(\d+)/);
            return {
                redis: {
                    connected: redis_1.redisManager.isReady(),
                    memory: memoryMatch ? memoryMatch[1].trim() : 'unknown',
                    keyspace: keyspaceMatch ? {
                        keys: parseInt(keyspaceMatch[1]),
                        expires: parseInt(keyspaceMatch[2])
                    } : { keys: 0, expires: 0 }
                },
                cache: cacheStats,
                sessions: {
                    activeSessions: activeSessions.length
                }
            };
        }
        catch (error) {
            console.error('Error getting system stats:', error);
            return {
                redis: {
                    connected: false,
                    memory: 'error',
                    keyspace: { keys: 0, expires: 0 }
                },
                cache: {
                    activeRaces: 0,
                    totalParticipants: 0,
                    totalBackups: 0
                },
                sessions: {
                    activeSessions: 0
                }
            };
        }
    }
    async get(key) {
        try {
            const client = redis_1.redisManager.getClient();
            return await client.get(key);
        }
        catch (error) {
            console.error(`Error getting key ${key}:`, error);
            return null;
        }
    }
    async setWithExpiry(key, value, expiry) {
        try {
            const client = redis_1.redisManager.getClient();
            await client.setEx(key, expiry, value);
            return true;
        }
        catch (error) {
            console.error(`Error setting key ${key}:`, error);
            return false;
        }
    }
    async delete(key) {
        try {
            const client = redis_1.redisManager.getClient();
            const result = await client.del(key);
            return result > 0;
        }
        catch (error) {
            console.error(`Error deleting key ${key}:`, error);
            return false;
        }
    }
    async listPush(key, value) {
        try {
            const client = redis_1.redisManager.getClient();
            return await client.lPush(key, value);
        }
        catch (error) {
            console.error(`Error pushing to list ${key}:`, error);
            return 0;
        }
    }
    async listRange(key, start, stop) {
        try {
            const client = redis_1.redisManager.getClient();
            return await client.lRange(key, start, stop);
        }
        catch (error) {
            console.error(`Error getting list range ${key}:`, error);
            return [];
        }
    }
    async listLength(key) {
        try {
            const client = redis_1.redisManager.getClient();
            return await client.lLen(key);
        }
        catch (error) {
            console.error(`Error getting list length ${key}:`, error);
            return 0;
        }
    }
    async listTrim(key, start, stop) {
        try {
            const client = redis_1.redisManager.getClient();
            await client.lTrim(key, start, stop);
            return true;
        }
        catch (error) {
            console.error(`Error trimming list ${key}:`, error);
            return false;
        }
    }
    async getKeys(pattern) {
        try {
            const client = redis_1.redisManager.getClient();
            return await client.keys(pattern);
        }
        catch (error) {
            console.error(`Error getting keys with pattern ${pattern}:`, error);
            return [];
        }
    }
    async getRaceState(raceId) {
        return await this.raceStateCache.getRaceState(raceId);
    }
    async setRaceState(raceId, raceState) {
        try {
            await this.raceStateCache.cacheRaceState(raceState);
            return true;
        }
        catch (error) {
            console.error(`Error setting race state ${raceId}:`, error);
            return false;
        }
    }
}
exports.RedisService = RedisService;
exports.redisService = new RedisService();
//# sourceMappingURL=RedisService.js.map