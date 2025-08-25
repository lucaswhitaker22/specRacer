import { redisService } from './RedisService';
import { getDatabaseConnection } from '../database/connection';
import { RaceState, ParticipantState } from '../../../shared/types';
import { ErrorLogger, AppError } from '../utils/ErrorLogger';

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

/**
 * Service for managing race state snapshots and recovery
 */
export class StateRecoveryService {
  private static instance: StateRecoveryService;
  private readonly logger = ErrorLogger.getInstance();
  private readonly snapshotInterval = 10000; // 10 seconds
  private readonly maxSnapshots = 50; // Keep last 50 snapshots per race
  private snapshotTimers = new Map<string, NodeJS.Timeout>();

  private constructor() {}

  public static getInstance(): StateRecoveryService {
    if (!StateRecoveryService.instance) {
      StateRecoveryService.instance = new StateRecoveryService();
    }
    return StateRecoveryService.instance;
  }

  /**
   * Start automatic state snapshots for a race
   */
  public startStateSnapshots(raceId: string): void {
    // Clear existing timer if any
    this.stopStateSnapshots(raceId);

    const timer = setInterval(async () => {
      try {
        await this.createStateSnapshot(raceId);
      } catch (error) {
        this.logger.logError(
          error as Error,
          { raceId, operation: 'automatic_snapshot' }
        );
      }
    }, this.snapshotInterval);

    this.snapshotTimers.set(raceId, timer);
  }

  /**
   * Stop automatic state snapshots for a race
   */
  public stopStateSnapshots(raceId: string): void {
    const timer = this.snapshotTimers.get(raceId);
    if (timer) {
      clearInterval(timer);
      this.snapshotTimers.delete(raceId);
    }
  }

  /**
   * Create a state snapshot
   */
  public async createStateSnapshot(raceId: string): Promise<string> {
    try {
      // Get current race state from Redis
      const raceState = await redisService.getRaceState(raceId);
      if (!raceState) {
        throw new AppError(
          'Race state not found for snapshot',
          404,
          'RACE_STATE_NOT_FOUND',
          { raceId }
        );
      }

      // Create snapshot
      const snapshot: StateSnapshot = {
        id: this.generateSnapshotId(raceId),
        raceId,
        timestamp: Date.now(),
        raceState,
        checksum: this.calculateChecksum(raceState)
      };

      // Store snapshot in Redis
      const snapshotKey = `race_snapshot:${raceId}:${snapshot.id}`;
      await redisService.setWithExpiry(
        snapshotKey,
        JSON.stringify(snapshot),
        3600 // 1 hour expiry
      );

      // Add to snapshot list
      const listKey = `race_snapshots:${raceId}`;
      await redisService.listPush(listKey, snapshot.id);

      // Trim old snapshots
      await this.trimOldSnapshots(raceId);

      this.logger.logInfo(
        'State snapshot created',
        'SNAPSHOT_CREATED',
        { raceId, snapshotId: snapshot.id }
      );

      return snapshot.id;
    } catch (error) {
      this.logger.logError(
        error as Error,
        { raceId, operation: 'create_snapshot' }
      );
      throw error;
    }
  }

  /**
   * Recover race state from the most recent valid snapshot
   */
  public async recoverRaceState(raceId: string): Promise<RecoveryResult> {
    try {
      // Get list of snapshots for this race
      const snapshots = await this.getSnapshotList(raceId);
      if (snapshots.length === 0) {
        return await this.createFallbackState(raceId);
      }

      // Try to recover from most recent snapshots first
      for (const snapshotId of snapshots.reverse()) {
        try {
          const snapshot = await this.getSnapshot(raceId, snapshotId);
          if (snapshot && this.validateSnapshot(snapshot)) {
            // Restore state to Redis
            await redisService.setRaceState(raceId, snapshot.raceState);
            
            this.logger.logInfo(
              'Race state recovered from snapshot',
              'STATE_RECOVERED',
              { raceId, snapshotId }
            );

            return {
              success: true,
              recoveredState: snapshot.raceState
            };
          }
        } catch (error) {
          this.logger.logWarning(
            `Failed to recover from snapshot ${snapshotId}`,
            'SNAPSHOT_RECOVERY_FAILED',
            { raceId, snapshotId, error: (error as Error).message }
          );
          continue;
        }
      }

      // If no snapshots worked, create fallback state
      return await this.createFallbackState(raceId);
    } catch (error) {
      this.logger.logError(
        error as Error,
        { raceId, operation: 'recover_state' }
      );

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Rollback race state to a specific snapshot
   */
  public async rollbackToSnapshot(raceId: string, snapshotId: string): Promise<RecoveryResult> {
    try {
      const snapshot = await this.getSnapshot(raceId, snapshotId);
      if (!snapshot) {
        throw new AppError(
          'Snapshot not found',
          404,
          'SNAPSHOT_NOT_FOUND',
          { raceId, snapshotId }
        );
      }

      if (!this.validateSnapshot(snapshot)) {
        throw new AppError(
          'Snapshot validation failed',
          400,
          'INVALID_SNAPSHOT',
          { raceId, snapshotId }
        );
      }

      // Restore state to Redis
      await redisService.setRaceState(raceId, snapshot.raceState);

      this.logger.logInfo(
        'Race state rolled back to snapshot',
        'STATE_ROLLBACK',
        { raceId, snapshotId }
      );

      return {
        success: true,
        recoveredState: snapshot.raceState
      };
    } catch (error) {
      this.logger.logError(
        error as Error,
        { raceId, snapshotId, operation: 'rollback_snapshot' }
      );

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get available snapshots for a race
   */
  public async getAvailableSnapshots(raceId: string): Promise<StateSnapshot[]> {
    try {
      const snapshotIds = await this.getSnapshotList(raceId);
      const snapshots: StateSnapshot[] = [];

      for (const snapshotId of snapshotIds) {
        const snapshot = await this.getSnapshot(raceId, snapshotId);
        if (snapshot) {
          // Don't include full race state in list view
          snapshots.push({
            ...snapshot,
            raceState: {} as RaceState // Empty for list view
          });
        }
      }

      return snapshots.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      this.logger.logError(
        error as Error,
        { raceId, operation: 'get_snapshots' }
      );
      return [];
    }
  }

  /**
   * Clean up snapshots for completed races
   */
  public async cleanupRaceSnapshots(raceId: string): Promise<void> {
    try {
      this.stopStateSnapshots(raceId);

      const snapshotIds = await this.getSnapshotList(raceId);
      
      // Delete all snapshots
      for (const snapshotId of snapshotIds) {
        const snapshotKey = `race_snapshot:${raceId}:${snapshotId}`;
        await redisService.delete(snapshotKey);
      }

      // Delete snapshot list
      const listKey = `race_snapshots:${raceId}`;
      await redisService.delete(listKey);

      this.logger.logInfo(
        'Race snapshots cleaned up',
        'SNAPSHOTS_CLEANED',
        { raceId, count: snapshotIds.length }
      );
    } catch (error) {
      this.logger.logError(
        error as Error,
        { raceId, operation: 'cleanup_snapshots' }
      );
    }
  }

  private async getSnapshot(raceId: string, snapshotId: string): Promise<StateSnapshot | null> {
    try {
      const snapshotKey = `race_snapshot:${raceId}:${snapshotId}`;
      const snapshotData = await redisService.get(snapshotKey);
      
      if (!snapshotData) {
        return null;
      }

      return JSON.parse(snapshotData) as StateSnapshot;
    } catch (error) {
      this.logger.logWarning(
        'Failed to parse snapshot data',
        'SNAPSHOT_PARSE_ERROR',
        { raceId, snapshotId }
      );
      return null;
    }
  }

  private async getSnapshotList(raceId: string): Promise<string[]> {
    const listKey = `race_snapshots:${raceId}`;
    return await redisService.listRange(listKey, 0, -1);
  }

  private async trimOldSnapshots(raceId: string): Promise<void> {
    const listKey = `race_snapshots:${raceId}`;
    const currentLength = await redisService.listLength(listKey);
    
    if (currentLength > this.maxSnapshots) {
      const toRemove = currentLength - this.maxSnapshots;
      
      // Get old snapshot IDs to delete
      const oldSnapshots = await redisService.listRange(listKey, 0, toRemove - 1);
      
      // Delete old snapshot data
      for (const snapshotId of oldSnapshots) {
        const snapshotKey = `race_snapshot:${raceId}:${snapshotId}`;
        await redisService.delete(snapshotKey);
      }
      
      // Trim the list
      await redisService.listTrim(listKey, toRemove, -1);
    }
  }

  private validateSnapshot(snapshot: StateSnapshot): boolean {
    try {
      // Validate basic structure
      if (!snapshot.raceState || !snapshot.raceState.raceId || !snapshot.raceState.participants) {
        return false;
      }

      // Validate checksum
      const calculatedChecksum = this.calculateChecksum(snapshot.raceState);
      if (calculatedChecksum !== snapshot.checksum) {
        this.logger.logWarning(
          'Snapshot checksum mismatch',
          'CHECKSUM_MISMATCH',
          { snapshotId: snapshot.id, expected: snapshot.checksum, actual: calculatedChecksum }
        );
        return false;
      }

      // Validate participant data
      for (const participant of snapshot.raceState.participants) {
        if (!participant.playerId || !participant.carId || participant.position < 1) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.logWarning(
        'Snapshot validation error',
        'VALIDATION_ERROR',
        { snapshotId: snapshot.id, error: (error as Error).message }
      );
      return false;
    }
  }

  private calculateChecksum(raceState: RaceState): string {
    // Simple checksum based on key race state properties
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

  private generateSnapshotId(raceId: string): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async createFallbackState(raceId: string): Promise<RecoveryResult> {
    try {
      // Try to get race configuration from database
      const db = getDatabaseConnection();
      const raceResult = await db.query(
        'SELECT * FROM races WHERE id = $1',
        [raceId]
      );

      if (raceResult.rows.length === 0) {
        throw new AppError(
          'Race not found in database',
          404,
          'RACE_NOT_FOUND',
          { raceId }
        );
      }

      const raceData = raceResult.rows[0];
      
      // Get participants
      const participantsResult = await db.query(
        'SELECT * FROM race_participants WHERE race_id = $1',
        [raceId]
      );

      // Create minimal fallback state
      const fallbackState: RaceState = {
        raceId,
        trackId: raceData.track_id,
        currentLap: 1,
        totalLaps: raceData.total_laps || 10,
        raceTime: 0,
        participants: participantsResult.rows.map((p: any, index: number) => ({
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

      // Store fallback state
      await redisService.setRaceState(raceId, fallbackState);

      this.logger.logWarning(
        'Created fallback race state',
        'FALLBACK_STATE_CREATED',
        { raceId }
      );

      return {
        success: true,
        fallbackState
      };
    } catch (error) {
      this.logger.logError(
        error as Error,
        { raceId, operation: 'create_fallback' }
      );

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
}