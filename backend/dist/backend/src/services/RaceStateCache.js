"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaceStateCache = void 0;
const redis_1 = require("../database/redis");
class RaceStateCache {
    constructor() {
        this.RACE_STATE_PREFIX = 'race_state:';
        this.RACE_BACKUP_PREFIX = 'race_backup:';
        this.PARTICIPANT_PREFIX = 'participant:';
        this.RACE_EVENTS_PREFIX = 'race_events:';
        this.RACE_STATE_EXPIRY = 4 * 60 * 60;
        this.BACKUP_EXPIRY = 24 * 60 * 60;
        this.MAX_BACKUPS = 10;
    }
    getRaceStateKey(raceId) {
        return `${this.RACE_STATE_PREFIX}${raceId}`;
    }
    getRaceBackupKey(raceId, version) {
        return `${this.RACE_BACKUP_PREFIX}${raceId}:${version}`;
    }
    getParticipantKey(raceId, playerId) {
        return `${this.PARTICIPANT_PREFIX}${raceId}:${playerId}`;
    }
    getRaceEventsKey(raceId) {
        return `${this.RACE_EVENTS_PREFIX}${raceId}`;
    }
    async cacheRaceState(raceState) {
        try {
            const client = redis_1.redisManager.getClient();
            await this.createBackup(raceState);
            await client.setEx(this.getRaceStateKey(raceState.raceId), this.RACE_STATE_EXPIRY, JSON.stringify(raceState));
            const participantPromises = raceState.participants.map(participant => client.setEx(this.getParticipantKey(raceState.raceId, participant.playerId), this.RACE_STATE_EXPIRY, JSON.stringify(participant)));
            await client.setEx(this.getRaceEventsKey(raceState.raceId), this.RACE_STATE_EXPIRY, JSON.stringify(raceState.raceEvents));
            await Promise.all(participantPromises);
            return true;
        }
        catch (error) {
            console.error('Error caching race state:', error);
            return false;
        }
    }
    async getRaceState(raceId) {
        try {
            const client = redis_1.redisManager.getClient();
            const raceStateData = await client.get(this.getRaceStateKey(raceId));
            if (!raceStateData) {
                return null;
            }
            return JSON.parse(raceStateData);
        }
        catch (error) {
            console.error('Error getting race state:', error);
            return null;
        }
    }
    async updateParticipant(raceId, participant) {
        try {
            const client = redis_1.redisManager.getClient();
            await client.setEx(this.getParticipantKey(raceId, participant.playerId), this.RACE_STATE_EXPIRY, JSON.stringify(participant));
            const raceState = await this.getRaceState(raceId);
            if (raceState) {
                const participantIndex = raceState.participants.findIndex(p => p.playerId === participant.playerId);
                if (participantIndex !== -1) {
                    raceState.participants[participantIndex] = participant;
                    await this.cacheRaceState(raceState);
                }
            }
            return true;
        }
        catch (error) {
            console.error('Error updating participant:', error);
            return false;
        }
    }
    async getParticipant(raceId, playerId) {
        try {
            const client = redis_1.redisManager.getClient();
            const participantData = await client.get(this.getParticipantKey(raceId, playerId));
            if (!participantData) {
                return null;
            }
            return JSON.parse(participantData);
        }
        catch (error) {
            console.error('Error getting participant:', error);
            return null;
        }
    }
    async addRaceEvent(raceId, event) {
        try {
            const client = redis_1.redisManager.getClient();
            const eventsData = await client.get(this.getRaceEventsKey(raceId));
            let events = eventsData ? JSON.parse(eventsData) : [];
            events.push(event);
            if (events.length > 100) {
                events = events.slice(-100);
            }
            await client.setEx(this.getRaceEventsKey(raceId), this.RACE_STATE_EXPIRY, JSON.stringify(events));
            const raceState = await this.getRaceState(raceId);
            if (raceState) {
                raceState.raceEvents = events;
                await this.cacheRaceState(raceState);
            }
            return true;
        }
        catch (error) {
            console.error('Error adding race event:', error);
            return false;
        }
    }
    async getRaceEvents(raceId) {
        try {
            const client = redis_1.redisManager.getClient();
            const eventsData = await client.get(this.getRaceEventsKey(raceId));
            if (!eventsData) {
                return [];
            }
            return JSON.parse(eventsData);
        }
        catch (error) {
            console.error('Error getting race events:', error);
            return [];
        }
    }
    async createBackup(raceState) {
        try {
            const client = redis_1.redisManager.getClient();
            const backupKeys = await client.keys(`${this.RACE_BACKUP_PREFIX}${raceState.raceId}:*`);
            const version = backupKeys.length + 1;
            const backup = {
                raceState,
                timestamp: Date.now(),
                version
            };
            await client.setEx(this.getRaceBackupKey(raceState.raceId, version), this.BACKUP_EXPIRY, JSON.stringify(backup));
            if (backupKeys.length >= this.MAX_BACKUPS) {
                const sortedKeys = backupKeys.sort((a, b) => {
                    const versionA = parseInt(a.split(':').pop() || '0');
                    const versionB = parseInt(b.split(':').pop() || '0');
                    return versionA - versionB;
                });
                const oldestBackups = sortedKeys.slice(0, backupKeys.length - this.MAX_BACKUPS + 1);
                if (oldestBackups.length > 0) {
                    await client.del(oldestBackups);
                }
            }
            return true;
        }
        catch (error) {
            console.error('Error creating backup:', error);
            return false;
        }
    }
    async restoreFromBackup(raceId, version) {
        try {
            const client = redis_1.redisManager.getClient();
            let backupKey;
            if (version) {
                backupKey = this.getRaceBackupKey(raceId, version);
            }
            else {
                const backupKeys = await client.keys(`${this.RACE_BACKUP_PREFIX}${raceId}:*`);
                if (backupKeys.length === 0) {
                    return null;
                }
                backupKey = backupKeys.sort().pop();
            }
            const backupData = await client.get(backupKey);
            if (!backupData) {
                return null;
            }
            const backup = JSON.parse(backupData);
            await this.cacheRaceState(backup.raceState);
            return backup.raceState;
        }
        catch (error) {
            console.error('Error restoring from backup:', error);
            return null;
        }
    }
    async getAvailableBackups(raceId) {
        try {
            const client = redis_1.redisManager.getClient();
            const backupKeys = await client.keys(`${this.RACE_BACKUP_PREFIX}${raceId}:*`);
            const backups = [];
            for (const key of backupKeys) {
                const backupData = await client.get(key);
                if (backupData) {
                    const backup = JSON.parse(backupData);
                    backups.push({
                        raceState: backup.raceState,
                        timestamp: backup.timestamp,
                        version: backup.version
                    });
                }
            }
            return backups.sort((a, b) => b.version - a.version);
        }
        catch (error) {
            console.error('Error getting available backups:', error);
            return [];
        }
    }
    async removeRace(raceId) {
        try {
            const client = redis_1.redisManager.getClient();
            const [raceStateKeys, backupKeys, participantKeys, eventKeys] = await Promise.all([
                client.keys(this.getRaceStateKey(raceId)),
                client.keys(`${this.RACE_BACKUP_PREFIX}${raceId}:*`),
                client.keys(`${this.PARTICIPANT_PREFIX}${raceId}:*`),
                client.keys(this.getRaceEventsKey(raceId))
            ]);
            const allKeys = [...raceStateKeys, ...backupKeys, ...participantKeys, ...eventKeys];
            if (allKeys.length > 0) {
                await client.del(allKeys);
            }
            return true;
        }
        catch (error) {
            console.error('Error removing race from cache:', error);
            return false;
        }
    }
    async getCacheStats() {
        try {
            const client = redis_1.redisManager.getClient();
            const [raceKeys, participantKeys, backupKeys] = await Promise.all([
                client.keys(`${this.RACE_STATE_PREFIX}*`),
                client.keys(`${this.PARTICIPANT_PREFIX}*`),
                client.keys(`${this.RACE_BACKUP_PREFIX}*`)
            ]);
            return {
                activeRaces: raceKeys.length,
                totalParticipants: participantKeys.length,
                totalBackups: backupKeys.length
            };
        }
        catch (error) {
            console.error('Error getting cache stats:', error);
            return {
                activeRaces: 0,
                totalParticipants: 0,
                totalBackups: 0
            };
        }
    }
}
exports.RaceStateCache = RaceStateCache;
//# sourceMappingURL=RaceStateCache.js.map