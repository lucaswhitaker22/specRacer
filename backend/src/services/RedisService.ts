import { redisManager } from '../database/redis';
import { SessionService } from './SessionService';
import { RaceStateCache } from './RaceStateCache';

export class RedisService {
  private sessionService: SessionService;
  private raceStateCache: RaceStateCache;

  constructor() {
    this.sessionService = new SessionService();
    this.raceStateCache = new RaceStateCache();
  }

  /**
   * Initialize Redis connection and services
   */
  async initialize(): Promise<void> {
    try {
      await redisManager.connect();
      console.log('Redis services initialized successfully');
      
      // Start cleanup interval for expired sessions
      this.startCleanupInterval();
    } catch (error) {
      console.warn('Redis not available - running in degraded mode without caching:', (error as Error).message);
      // Don't throw error, allow server to continue without Redis
    }
  }

  /**
   * Shutdown Redis connection and cleanup
   */
  async shutdown(): Promise<void> {
    try {
      await redisManager.disconnect();
      console.log('Redis services shut down successfully');
    } catch (error) {
      console.error('Error shutting down Redis services:', error);
    }
  }

  /**
   * Health check for Redis services
   */
  async healthCheck(): Promise<{
    redis: boolean;
    services: boolean;
    stats: any;
  }> {
    try {
      const redisHealth = await redisManager.ping();
      const cacheStats = await this.raceStateCache.getCacheStats();
      const activeSessions = await this.sessionService.getActiveSessions();

      return {
        redis: redisHealth,
        services: true,
        stats: {
          ...cacheStats,
          activeSessions: activeSessions.length,
          isConnected: redisManager.isReady()
        }
      };
    } catch (error) {
      console.error('Redis health check failed:', error);
      return {
        redis: false,
        services: false,
        stats: null
      };
    }
  }

  /**
   * Get session service instance
   */
  getSessionService(): SessionService {
    return this.sessionService;
  }

  /**
   * Get race state cache instance
   */
  getRaceStateCache(): RaceStateCache {
    return this.raceStateCache;
  }

  /**
   * Start periodic cleanup of expired data
   */
  private startCleanupInterval(): void {
    // Run cleanup every hour
    setInterval(async () => {
      try {
        const cleanedSessions = await this.sessionService.cleanupExpiredSessions();
        if (cleanedSessions > 0) {
          console.log(`Cleaned up ${cleanedSessions} expired sessions`);
        }
      } catch (error) {
        console.error('Error during periodic cleanup:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Emergency recovery - attempt to restore system state
   */
  async emergencyRecovery(): Promise<{
    success: boolean;
    message: string;
    recoveredRaces: string[];
  }> {
    try {
      console.log('Starting emergency recovery...');
      
      // Get all race IDs that have backups
      const client = redisManager.getClient();
      const backupKeys = await client.keys('race_backup:*');
      
      const raceIds = new Set<string>();
      backupKeys.forEach(key => {
        const raceId = key.split(':')[1];
        if (raceId) {
          raceIds.add(raceId);
        }
      });

      const recoveredRaces: string[] = [];
      
      // Attempt to restore each race from its latest backup
      for (const raceId of raceIds) {
        try {
          const restoredState = await this.raceStateCache.restoreFromBackup(raceId);
          if (restoredState) {
            recoveredRaces.push(raceId);
            console.log(`Recovered race ${raceId} from backup`);
          }
        } catch (error) {
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
    } catch (error) {
      const message = `Emergency recovery failed: ${error}`;
      console.error(message);
      
      return {
        success: false,
        message,
        recoveredRaces: []
      };
    }
  }

  /**
   * Clear all cached data (use with caution)
   */
  async clearAllCache(): Promise<boolean> {
    try {
      const client = redisManager.getClient();
      await client.flushDb();
      console.log('All Redis cache cleared');
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Get comprehensive system statistics
   */
  async getSystemStats(): Promise<{
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
  }> {
    try {
      const client = redisManager.getClient();
      const [info, cacheStats, activeSessions] = await Promise.all([
        client.info(),
        this.raceStateCache.getCacheStats(),
        this.sessionService.getActiveSessions()
      ]);

      // Parse Redis info for relevant metrics
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const keyspaceMatch = info.match(/db0:keys=(\d+),expires=(\d+)/);

      return {
        redis: {
          connected: redisManager.isReady(),
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
    } catch (error) {
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

  /**
   * Direct Redis operations for state recovery service
   */
  async get(key: string): Promise<string | null> {
    try {
      const client = redisManager.getClient();
      return await client.get(key);
    } catch (error) {
      console.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  async setWithExpiry(key: string, value: string, expiry: number): Promise<boolean> {
    try {
      const client = redisManager.getClient();
      await client.setEx(key, expiry, value);
      return true;
    } catch (error) {
      console.error(`Error setting key ${key}:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const client = redisManager.getClient();
      const result = await client.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Error deleting key ${key}:`, error);
      return false;
    }
  }

  async listPush(key: string, value: string): Promise<number> {
    try {
      const client = redisManager.getClient();
      return await client.lPush(key, value);
    } catch (error) {
      console.error(`Error pushing to list ${key}:`, error);
      return 0;
    }
  }

  async listRange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const client = redisManager.getClient();
      return await client.lRange(key, start, stop);
    } catch (error) {
      console.error(`Error getting list range ${key}:`, error);
      return [];
    }
  }

  async listLength(key: string): Promise<number> {
    try {
      const client = redisManager.getClient();
      return await client.lLen(key);
    } catch (error) {
      console.error(`Error getting list length ${key}:`, error);
      return 0;
    }
  }

  async listTrim(key: string, start: number, stop: number): Promise<boolean> {
    try {
      const client = redisManager.getClient();
      await client.lTrim(key, start, stop);
      return true;
    } catch (error) {
      console.error(`Error trimming list ${key}:`, error);
      return false;
    }
  }

  async getKeys(pattern: string): Promise<string[]> {
    try {
      const client = redisManager.getClient();
      return await client.keys(pattern);
    } catch (error) {
      console.error(`Error getting keys with pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Race state operations for state recovery
   */
  async getRaceState(raceId: string): Promise<any> {
    return await this.raceStateCache.getRaceState(raceId);
  }

  async setRaceState(raceId: string, raceState: any): Promise<boolean> {
    try {
      await this.raceStateCache.cacheRaceState(raceState);
      return true;
    } catch (error) {
      console.error(`Error setting race state ${raceId}:`, error);
      return false;
    }
  }
}

// Singleton instance
export const redisService = new RedisService();