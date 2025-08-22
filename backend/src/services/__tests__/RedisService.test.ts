import { RedisService } from '../RedisService';
import { redisManager } from '../../database/redis';

// Mock Redis manager and services
jest.mock('../../database/redis', () => ({
  redisManager: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    ping: jest.fn(),
    isReady: jest.fn(),
    getClient: jest.fn()
  }
}));

jest.mock('../SessionService');
jest.mock('../RaceStateCache');

describe('RedisService', () => {
  let redisService: RedisService;
  let mockRedisClient: any;

  beforeEach(() => {
    redisService = new RedisService();
    mockRedisClient = {
      info: jest.fn(),
      keys: jest.fn(),
      get: jest.fn(),
      flushDb: jest.fn()
    };
    (redisManager.getClient as jest.Mock).mockReturnValue(mockRedisClient);
    
    // Clear all timers
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('initialize', () => {
    it('should initialize Redis connection successfully', async () => {
      (redisManager.connect as jest.Mock).mockResolvedValue(undefined);

      await redisService.initialize();

      expect(redisManager.connect).toHaveBeenCalled();
    });

    it('should throw error if Redis connection fails', async () => {
      const error = new Error('Connection failed');
      (redisManager.connect as jest.Mock).mockRejectedValue(error);

      await expect(redisService.initialize()).rejects.toThrow('Connection failed');
    });

    it('should start cleanup interval', async () => {
      (redisManager.connect as jest.Mock).mockResolvedValue(undefined);
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      await redisService.initialize();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        60 * 60 * 1000 // 1 hour
      );
    });
  });

  describe('shutdown', () => {
    it('should disconnect Redis successfully', async () => {
      (redisManager.disconnect as jest.Mock).mockResolvedValue(undefined);

      await redisService.shutdown();

      expect(redisManager.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      const error = new Error('Disconnect failed');
      (redisManager.disconnect as jest.Mock).mockRejectedValue(error);

      // Should not throw
      await redisService.shutdown();

      expect(redisManager.disconnect).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when Redis is working', async () => {
      (redisManager.ping as jest.Mock).mockResolvedValue(true);
      (redisManager.isReady as jest.Mock).mockReturnValue(true);
      
      // Mock cache stats and active sessions
      const mockCacheStats = {
        activeRaces: 2,
        totalParticipants: 4,
        totalBackups: 6
      };
      
      const mockActiveSessions = [
        { playerId: 'player1', username: 'user1' },
        { playerId: 'player2', username: 'user2' }
      ];

      // Mock the service methods
      jest.spyOn(redisService.getRaceStateCache(), 'getCacheStats')
        .mockResolvedValue(mockCacheStats);
      jest.spyOn(redisService.getSessionService(), 'getActiveSessions')
        .mockResolvedValue(mockActiveSessions as any);

      const result = await redisService.healthCheck();

      expect(result).toEqual({
        redis: true,
        services: true,
        stats: {
          ...mockCacheStats,
          activeSessions: 2,
          isConnected: true
        }
      });
    });

    it('should return unhealthy status when Redis fails', async () => {
      (redisManager.ping as jest.Mock).mockRejectedValue(new Error('Redis down'));

      const result = await redisService.healthCheck();

      expect(result).toEqual({
        redis: false,
        services: false,
        stats: null
      });
    });
  });

  describe('emergencyRecovery', () => {
    it('should recover races from backups', async () => {
      const backupKeys = [
        'race_backup:race1:1',
        'race_backup:race1:2',
        'race_backup:race2:1'
      ];
      
      mockRedisClient.keys.mockResolvedValue(backupKeys);
      
      // Mock successful restoration
      jest.spyOn(redisService.getRaceStateCache(), 'restoreFromBackup')
        .mockResolvedValueOnce({ raceId: 'race1' } as any)
        .mockResolvedValueOnce({ raceId: 'race2' } as any);

      const result = await redisService.emergencyRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveredRaces).toEqual(['race1', 'race2']);
      expect(result.message).toContain('Recovered 2 races');
    });

    it('should handle recovery failures gracefully', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.emergencyRecovery();

      expect(result.success).toBe(false);
      expect(result.recoveredRaces).toEqual([]);
      expect(result.message).toContain('Emergency recovery failed');
    });

    it('should handle partial recovery failures', async () => {
      const backupKeys = [
        'race_backup:race1:1',
        'race_backup:race2:1'
      ];
      
      mockRedisClient.keys.mockResolvedValue(backupKeys);
      
      // Mock one successful, one failed restoration
      jest.spyOn(redisService.getRaceStateCache(), 'restoreFromBackup')
        .mockResolvedValueOnce({ raceId: 'race1' } as any)
        .mockResolvedValueOnce(null);

      const result = await redisService.emergencyRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveredRaces).toEqual(['race1']);
      expect(result.message).toContain('Recovered 1 races');
    });
  });

  describe('clearAllCache', () => {
    it('should clear all Redis data', async () => {
      mockRedisClient.flushDb.mockResolvedValue('OK');

      const result = await redisService.clearAllCache();

      expect(result).toBe(true);
      expect(mockRedisClient.flushDb).toHaveBeenCalled();
    });

    it('should handle clear cache errors', async () => {
      mockRedisClient.flushDb.mockRejectedValue(new Error('Clear failed'));

      const result = await redisService.clearAllCache();

      expect(result).toBe(false);
    });
  });

  describe('getSystemStats', () => {
    it('should return comprehensive system statistics', async () => {
      const mockInfo = `
        used_memory_human:2.5M
        db0:keys=150,expires=75
      `;
      
      mockRedisClient.info.mockResolvedValue(mockInfo);
      (redisManager.isReady as jest.Mock).mockReturnValue(true);
      
      const mockCacheStats = {
        activeRaces: 3,
        totalParticipants: 6,
        totalBackups: 9
      };
      
      const mockActiveSessions = [
        { playerId: 'player1' },
        { playerId: 'player2' },
        { playerId: 'player3' }
      ];

      jest.spyOn(redisService.getRaceStateCache(), 'getCacheStats')
        .mockResolvedValue(mockCacheStats);
      jest.spyOn(redisService.getSessionService(), 'getActiveSessions')
        .mockResolvedValue(mockActiveSessions as any);

      const result = await redisService.getSystemStats();

      expect(result).toEqual({
        redis: {
          connected: true,
          memory: '2.5M',
          keyspace: {
            keys: 150,
            expires: 75
          }
        },
        cache: mockCacheStats,
        sessions: {
          activeSessions: 3
        }
      });
    });

    it('should handle missing Redis info gracefully', async () => {
      mockRedisClient.info.mockResolvedValue('');
      (redisManager.isReady as jest.Mock).mockReturnValue(false);
      
      jest.spyOn(redisService.getRaceStateCache(), 'getCacheStats')
        .mockResolvedValue({
          activeRaces: 0,
          totalParticipants: 0,
          totalBackups: 0
        });
      jest.spyOn(redisService.getSessionService(), 'getActiveSessions')
        .mockResolvedValue([]);

      const result = await redisService.getSystemStats();

      expect(result.redis.connected).toBe(false);
      expect(result.redis.memory).toBe('unknown');
      expect(result.redis.keyspace).toEqual({ keys: 0, expires: 0 });
    });

    it('should handle system stats errors', async () => {
      mockRedisClient.info.mockRejectedValue(new Error('Info failed'));

      const result = await redisService.getSystemStats();

      expect(result.redis.connected).toBe(false);
      expect(result.redis.memory).toBe('error');
      expect(result.cache).toEqual({
        activeRaces: 0,
        totalParticipants: 0,
        totalBackups: 0
      });
    });
  });

  describe('cleanup interval', () => {
    it('should run cleanup periodically', async () => {
      (redisManager.connect as jest.Mock).mockResolvedValue(undefined);
      
      const mockCleanup = jest.spyOn(redisService.getSessionService(), 'cleanupExpiredSessions')
        .mockResolvedValue(5);

      await redisService.initialize();

      // Fast-forward time by 1 hour
      jest.advanceTimersByTime(60 * 60 * 1000);

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      (redisManager.connect as jest.Mock).mockResolvedValue(undefined);
      
      const mockCleanup = jest.spyOn(redisService.getSessionService(), 'cleanupExpiredSessions')
        .mockRejectedValue(new Error('Cleanup failed'));

      await redisService.initialize();

      // Should not throw when cleanup fails
      jest.advanceTimersByTime(60 * 60 * 1000);

      expect(mockCleanup).toHaveBeenCalled();
    });
  });
});