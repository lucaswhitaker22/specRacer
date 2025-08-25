"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateRecoveryService = void 0;
const RedisService_1 = require("./RedisService");
const connection_1 = require("../database/connection");
const ErrorLogger_1 = require("../utils/ErrorLogger");
class StateRecoveryService {
    constructor() {
        this.logger = ErrorLogger_1.ErrorLogger.getInstance();
        this.snapshotInterval = 10000;
        this.maxSnapshots = 50;
        this.snapshotTimers = new Map();
    }
    static getInstance() {
        if (!StateRecoveryService.instance) {
            StateRecoveryService.instance = new StateRecoveryService();
        }
        return StateRecoveryService.instance;
    }
    startStateSnapshots(raceId) {
        this.stopStateSnapshots(raceId);
        const timer = setInterval(async () => {
            try {
                await this.createStateSnapshot(raceId);
            }
            catch (error) {
                this.logger.logError(error, { raceId, operation: 'automatic_snapshot' });
            }
        }, this.snapshotInterval);
        this.snapshotTimers.set(raceId, timer);
    }
    stopStateSnapshots(raceId) {
        const timer = this.snapshotTimers.get(raceId);
        if (timer) {
            clearInterval(timer);
            this.snapshotTimers.delete(raceId);
        }
    }
    async createStateSnapshot(raceId) {
        try {
            const raceState = await RedisService_1.redisService.getRaceState(raceId);
            if (!raceState) {
                throw new ErrorLogger_1.AppError('Race state not found for snapshot', 404, 'RACE_STATE_NOT_FOUND', { raceId });
            }
            const snapshot = {
                id: this.generateSnapshotId(raceId),
                raceId,
                timestamp: Date.now(),
                raceState,
                checksum: this.calculateChecksum(raceState)
            };
            const snapshotKey = `race_snapshot:${raceId}:${snapshot.id}`;
            await RedisService_1.redisService.setWithExpiry(snapshotKey, JSON.stringify(snapshot), 3600);
            const listKey = `race_snapshots:${raceId}`;
            await RedisService_1.redisService.listPush(listKey, snapshot.id);
            await this.trimOldSnapshots(raceId);
            this.logger.logInfo('State snapshot created', 'SNAPSHOT_CREATED', { raceId, snapshotId: snapshot.id });
            return snapshot.id;
        }
        catch (error) {
            this.logger.logError(error, { raceId, operation: 'create_snapshot' });
            throw error;
        }
    }
    async recoverRaceState(raceId) {
        try {
            const snapshots = await this.getSnapshotList(raceId);
            if (snapshots.length === 0) {
                return await this.createFallbackState(raceId);
            }
            for (const snapshotId of snapshots.reverse()) {
                try {
                    const snapshot = await this.getSnapshot(raceId, snapshotId);
                    if (snapshot && this.validateSnapshot(snapshot)) {
                        await RedisService_1.redisService.setRaceState(raceId, snapshot.raceState);
                        this.logger.logInfo('Race state recovered from snapshot', 'STATE_RECOVERED', { raceId, snapshotId });
                        return {
                            success: true,
                            recoveredState: snapshot.raceState
                        };
                    }
                }
                catch (error) {
                    this.logger.logWarning(`Failed to recover from snapshot ${snapshotId}`, 'SNAPSHOT_RECOVERY_FAILED', { raceId, snapshotId, error: error.message });
                    continue;
                }
            }
            return await this.createFallbackState(raceId);
        }
        catch (error) {
            this.logger.logError(error, { raceId, operation: 'recover_state' });
            return {
                success: false,
                error: error.message
            };
        }
    }
    async rollbackToSnapshot(raceId, snapshotId) {
        try {
            const snapshot = await this.getSnapshot(raceId, snapshotId);
            if (!snapshot) {
                throw new ErrorLogger_1.AppError('Snapshot not found', 404, 'SNAPSHOT_NOT_FOUND', { raceId, snapshotId });
            }
            if (!this.validateSnapshot(snapshot)) {
                throw new ErrorLogger_1.AppError('Snapshot validation failed', 400, 'INVALID_SNAPSHOT', { raceId, snapshotId });
            }
            await RedisService_1.redisService.setRaceState(raceId, snapshot.raceState);
            this.logger.logInfo('Race state rolled back to snapshot', 'STATE_ROLLBACK', { raceId, snapshotId });
            return {
                success: true,
                recoveredState: snapshot.raceState
            };
        }
        catch (error) {
            this.logger.logError(error, { raceId, snapshotId, operation: 'rollback_snapshot' });
            return {
                success: false,
                error: error.message
            };
        }
    }
    async getAvailableSnapshots(raceId) {
        try {
            const snapshotIds = await this.getSnapshotList(raceId);
            const snapshots = [];
            for (const snapshotId of snapshotIds) {
                const snapshot = await this.getSnapshot(raceId, snapshotId);
                if (snapshot) {
                    snapshots.push({
                        ...snapshot,
                        raceState: {}
                    });
                }
            }
            return snapshots.sort((a, b) => b.timestamp - a.timestamp);
        }
        catch (error) {
            this.logger.logError(error, { raceId, operation: 'get_snapshots' });
            return [];
        }
    }
    async cleanupRaceSnapshots(raceId) {
        try {
            this.stopStateSnapshots(raceId);
            const snapshotIds = await this.getSnapshotList(raceId);
            for (const snapshotId of snapshotIds) {
                const snapshotKey = `race_snapshot:${raceId}:${snapshotId}`;
                await RedisService_1.redisService.delete(snapshotKey);
            }
            const listKey = `race_snapshots:${raceId}`;
            await RedisService_1.redisService.delete(listKey);
            this.logger.logInfo('Race snapshots cleaned up', 'SNAPSHOTS_CLEANED', { raceId, count: snapshotIds.length });
        }
        catch (error) {
            this.logger.logError(error, { raceId, operation: 'cleanup_snapshots' });
        }
    }
    async getSnapshot(raceId, snapshotId) {
        try {
            const snapshotKey = `race_snapshot:${raceId}:${snapshotId}`;
            const snapshotData = await RedisService_1.redisService.get(snapshotKey);
            if (!snapshotData) {
                return null;
            }
            return JSON.parse(snapshotData);
        }
        catch (error) {
            this.logger.logWarning('Failed to parse snapshot data', 'SNAPSHOT_PARSE_ERROR', { raceId, snapshotId });
            return null;
        }
    }
    async getSnapshotList(raceId) {
        const listKey = `race_snapshots:${raceId}`;
        return await RedisService_1.redisService.listRange(listKey, 0, -1);
    }
    async trimOldSnapshots(raceId) {
        const listKey = `race_snapshots:${raceId}`;
        const currentLength = await RedisService_1.redisService.listLength(listKey);
        if (currentLength > this.maxSnapshots) {
            const toRemove = currentLength - this.maxSnapshots;
            const oldSnapshots = await RedisService_1.redisService.listRange(listKey, 0, toRemove - 1);
            for (const snapshotId of oldSnapshots) {
                const snapshotKey = `race_snapshot:${raceId}:${snapshotId}`;
                await RedisService_1.redisService.delete(snapshotKey);
            }
            await RedisService_1.redisService.listTrim(listKey, toRemove, -1);
        }
    }
    validateSnapshot(snapshot) {
        try {
            if (!snapshot.raceState || !snapshot.raceState.raceId || !snapshot.raceState.participants) {
                return false;
            }
            const calculatedChecksum = this.calculateChecksum(snapshot.raceState);
            if (calculatedChecksum !== snapshot.checksum) {
                this.logger.logWarning('Snapshot checksum mismatch', 'CHECKSUM_MISMATCH', { snapshotId: snapshot.id, expected: snapshot.checksum, actual: calculatedChecksum });
                return false;
            }
            for (const participant of snapshot.raceState.participants) {
                if (!participant.playerId || !participant.carId || participant.position < 1) {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            this.logger.logWarning('Snapshot validation error', 'VALIDATION_ERROR', { snapshotId: snapshot.id, error: error.message });
            return false;
        }
    }
    calculateChecksum(raceState) {
        const data = {
            raceId: raceState.raceId,
            currentLap: raceState.currentLap,
            raceTime: raceState.raceTime,
            participantCount: raceState.participants.length,
            participantPositions: raceState.participants.map(p => ({
                id: p.playerId,
                position: p.position,
                totalTime: p.totalTime
            }))
        };
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }
    generateSnapshotId(raceId) {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async createFallbackState(raceId) {
        try {
            const db = (0, connection_1.getDatabaseConnection)();
            const raceResult = await db.query('SELECT * FROM races WHERE id = $1', [raceId]);
            if (raceResult.rows.length === 0) {
                throw new ErrorLogger_1.AppError('Race not found in database', 404, 'RACE_NOT_FOUND', { raceId });
            }
            const raceData = raceResult.rows[0];
            const participantsResult = await db.query('SELECT * FROM race_participants WHERE race_id = $1', [raceId]);
            const fallbackState = {
                raceId,
                trackId: raceData.track_id,
                currentLap: 1,
                totalLaps: raceData.total_laps || 10,
                raceTime: 0,
                participants: participantsResult.rows.map((p, index) => ({
                    playerId: p.player_id,
                    carId: p.car_id,
                    position: index + 1,
                    lapTime: 0,
                    totalTime: 0,
                    fuel: 100,
                    tireWear: { front: 0, rear: 0 },
                    speed: 0,
                    location: { lap: 1, sector: 1, distance: 0 },
                    lastCommand: '',
                    commandTimestamp: 0
                })),
                raceEvents: [],
                weather: {
                    temperature: 22,
                    humidity: 60,
                    windSpeed: 10,
                    precipitation: 0,
                    visibility: 10000
                },
                trackConditions: {
                    surface: 'dry',
                    grip: 1.0,
                    temperature: 25
                }
            };
            await RedisService_1.redisService.setRaceState(raceId, fallbackState);
            this.logger.logWarning('Created fallback race state', 'FALLBACK_STATE_CREATED', { raceId });
            return {
                success: true,
                fallbackState
            };
        }
        catch (error) {
            this.logger.logError(error, { raceId, operation: 'create_fallback' });
            return {
                success: false,
                error: error.message
            };
        }
    }
}
exports.StateRecoveryService = StateRecoveryService;
//# sourceMappingURL=StateRecoveryService.js.map