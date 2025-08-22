import { redisManager } from '../database/redis';
import { RaceState, ParticipantState, RaceEvent } from '../../../shared/types';

export interface RaceStateBackup {
  raceState: RaceState;
  timestamp: number;
  version: number;
}

export class RaceStateCache {
  private readonly RACE_STATE_PREFIX = 'race_state:';
  private readonly RACE_BACKUP_PREFIX = 'race_backup:';
  private readonly PARTICIPANT_PREFIX = 'participant:';
  private readonly RACE_EVENTS_PREFIX = 'race_events:';
  private readonly RACE_STATE_EXPIRY = 4 * 60 * 60; // 4 hours in seconds
  private readonly BACKUP_EXPIRY = 24 * 60 * 60; // 24 hours in seconds
  private readonly MAX_BACKUPS = 10; // Keep last 10 backups per race

  constructor() {}

  private getRaceStateKey(raceId: string): string {
    return `${this.RACE_STATE_PREFIX}${raceId}`;
  }

  private getRaceBackupKey(raceId: string, version: number): string {
    return `${this.RACE_BACKUP_PREFIX}${raceId}:${version}`;
  }

  private getParticipantKey(raceId: string, playerId: string): string {
    return `${this.PARTICIPANT_PREFIX}${raceId}:${playerId}`;
  }

  private getRaceEventsKey(raceId: string): string {
    return `${this.RACE_EVENTS_PREFIX}${raceId}`;
  }

  /**
   * Cache complete race state
   */
  async cacheRaceState(raceState: RaceState): Promise<boolean> {
    try {
      const client = redisManager.getClient();
      
      // Create backup before updating
      await this.createBackup(raceState);
      
      // Cache main race state
      await client.setEx(
        this.getRaceStateKey(raceState.raceId),
        this.RACE_STATE_EXPIRY,
        JSON.stringify(raceState)
      );

      // Cache individual participants for quick access
      const participantPromises = raceState.participants.map(participant =>
        client.setEx(
          this.getParticipantKey(raceState.raceId, participant.playerId),
          this.RACE_STATE_EXPIRY,
          JSON.stringify(participant)
        )
      );

      // Cache race events separately for efficient querying
      await client.setEx(
        this.getRaceEventsKey(raceState.raceId),
        this.RACE_STATE_EXPIRY,
        JSON.stringify(raceState.raceEvents)
      );

      await Promise.all(participantPromises);
      return true;
    } catch (error) {
      console.error('Error caching race state:', error);
      return false;
    }
  }

  /**
   * Get cached race state
   */
  async getRaceState(raceId: string): Promise<RaceState | null> {
    try {
      const client = redisManager.getClient();
      const raceStateData = await client.get(this.getRaceStateKey(raceId));
      
      if (!raceStateData) {
        return null;
      }

      return JSON.parse(raceStateData) as RaceState;
    } catch (error) {
      console.error('Error getting race state:', error);
      return null;
    }
  }

  /**
   * Update specific participant state
   */
  async updateParticipant(raceId: string, participant: ParticipantState): Promise<boolean> {
    try {
      const client = redisManager.getClient();
      
      // Update individual participant cache
      await client.setEx(
        this.getParticipantKey(raceId, participant.playerId),
        this.RACE_STATE_EXPIRY,
        JSON.stringify(participant)
      );

      // Update the full race state
      const raceState = await this.getRaceState(raceId);
      if (raceState) {
        const participantIndex = raceState.participants.findIndex(
          p => p.playerId === participant.playerId
        );
        
        if (participantIndex !== -1) {
          raceState.participants[participantIndex] = participant;
          await this.cacheRaceState(raceState);
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating participant:', error);
      return false;
    }
  }

  /**
   * Get specific participant state
   */
  async getParticipant(raceId: string, playerId: string): Promise<ParticipantState | null> {
    try {
      const client = redisManager.getClient();
      const participantData = await client.get(this.getParticipantKey(raceId, playerId));
      
      if (!participantData) {
        return null;
      }

      return JSON.parse(participantData) as ParticipantState;
    } catch (error) {
      console.error('Error getting participant:', error);
      return null;
    }
  }

  /**
   * Add race event to cache
   */
  async addRaceEvent(raceId: string, event: RaceEvent): Promise<boolean> {
    try {
      const client = redisManager.getClient();
      
      // Get current events
      const eventsData = await client.get(this.getRaceEventsKey(raceId));
      let events: RaceEvent[] = eventsData ? JSON.parse(eventsData) : [];
      
      // Add new event
      events.push(event);
      
      // Keep only last 100 events to prevent memory issues
      if (events.length > 100) {
        events = events.slice(-100);
      }

      // Update events cache
      await client.setEx(
        this.getRaceEventsKey(raceId),
        this.RACE_STATE_EXPIRY,
        JSON.stringify(events)
      );

      // Update full race state if it exists
      const raceState = await this.getRaceState(raceId);
      if (raceState) {
        raceState.raceEvents = events;
        await this.cacheRaceState(raceState);
      }

      return true;
    } catch (error) {
      console.error('Error adding race event:', error);
      return false;
    }
  }

  /**
   * Get race events
   */
  async getRaceEvents(raceId: string): Promise<RaceEvent[]> {
    try {
      const client = redisManager.getClient();
      const eventsData = await client.get(this.getRaceEventsKey(raceId));
      
      if (!eventsData) {
        return [];
      }

      return JSON.parse(eventsData) as RaceEvent[];
    } catch (error) {
      console.error('Error getting race events:', error);
      return [];
    }
  }

  /**
   * Create backup of race state
   */
  async createBackup(raceState: RaceState): Promise<boolean> {
    try {
      const client = redisManager.getClient();
      
      // Get current backup count
      const backupKeys = await client.keys(`${this.RACE_BACKUP_PREFIX}${raceState.raceId}:*`);
      const version = backupKeys.length + 1;

      const backup: RaceStateBackup = {
        raceState,
        timestamp: Date.now(),
        version
      };

      // Store backup
      await client.setEx(
        this.getRaceBackupKey(raceState.raceId, version),
        this.BACKUP_EXPIRY,
        JSON.stringify(backup)
      );

      // Clean up old backups if we exceed the limit
      if (backupKeys.length >= this.MAX_BACKUPS) {
        // Sort by version number (extract from key)
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
    } catch (error) {
      console.error('Error creating backup:', error);
      return false;
    }
  }

  /**
   * Restore race state from backup
   */
  async restoreFromBackup(raceId: string, version?: number): Promise<RaceState | null> {
    try {
      const client = redisManager.getClient();
      
      let backupKey: string;
      
      if (version) {
        backupKey = this.getRaceBackupKey(raceId, version);
      } else {
        // Get latest backup
        const backupKeys = await client.keys(`${this.RACE_BACKUP_PREFIX}${raceId}:*`);
        if (backupKeys.length === 0) {
          return null;
        }
        backupKey = backupKeys.sort().pop()!;
      }

      const backupData = await client.get(backupKey);
      if (!backupData) {
        return null;
      }

      const backup = JSON.parse(backupData) as RaceStateBackup;
      
      // Restore the race state to cache
      await this.cacheRaceState(backup.raceState);
      
      return backup.raceState;
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return null;
    }
  }

  /**
   * Get available backups for a race
   */
  async getAvailableBackups(raceId: string): Promise<RaceStateBackup[]> {
    try {
      const client = redisManager.getClient();
      const backupKeys = await client.keys(`${this.RACE_BACKUP_PREFIX}${raceId}:*`);
      
      const backups: RaceStateBackup[] = [];
      
      for (const key of backupKeys) {
        const backupData = await client.get(key);
        if (backupData) {
          const backup = JSON.parse(backupData) as RaceStateBackup;
          backups.push({
            raceState: backup.raceState,
            timestamp: backup.timestamp,
            version: backup.version
          });
        }
      }

      return backups.sort((a, b) => b.version - a.version);
    } catch (error) {
      console.error('Error getting available backups:', error);
      return [];
    }
  }

  /**
   * Remove race from cache
   */
  async removeRace(raceId: string): Promise<boolean> {
    try {
      const client = redisManager.getClient();
      
      // Get all keys related to this race
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
    } catch (error) {
      console.error('Error removing race from cache:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    activeRaces: number;
    totalParticipants: number;
    totalBackups: number;
  }> {
    try {
      const client = redisManager.getClient();
      
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
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        activeRaces: 0,
        totalParticipants: 0,
        totalBackups: 0
      };
    }
  }
}