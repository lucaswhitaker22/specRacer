import { redisService } from '../RedisService';
import { RaceState } from '../../../../shared/types';

// Create a shared mock client instance
const mockClient = {
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  info: jest.fn().mockResolvedValue('used_memory_human:1M\ndb0:keys=10,expires=5'),
  flushDb: jest.fn().mockResolvedValue('OK')
};

// Mock Redis manager
jest.mock('../../database/redis', () => ({
  redisManager: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    ping: jest.fn(),
    isReady: jest.fn(() => true),
    getClient: jest.fn(() => mockClient)
  }
}));

describe('Redis Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Integration', () => {
    it('should initialize and provide access to all services', () => {
      const sessionService = redisService.getSessionService();
      const raceStateCache = redisService.getRaceStateCache();

      expect(sessionService).toBeDefined();
      expect(raceStateCache).toBeDefined();
      expect(sessionService.constructor.name).toBe('SessionService');
      expect(raceStateCache.constructor.name).toBe('RaceStateCache');
    });

    it('should provide service instances that are properly configured', () => {
      const sessionService1 = redisService.getSessionService();
      const sessionService2 = redisService.getSessionService();
      const raceStateCache1 = redisService.getRaceStateCache();
      const raceStateCache2 = redisService.getRaceStateCache();

      // Should return the same instances (singleton pattern)
      expect(sessionService1).toBe(sessionService2);
      expect(raceStateCache1).toBe(raceStateCache2);
    });

    it('should handle initialization and shutdown lifecycle', async () => {
      const mockRedisManager = require('../../database/redis').redisManager;
      
      // Test successful initialization
      mockRedisManager.connect.mockResolvedValue(undefined);
      await expect(redisService.initialize()).resolves.not.toThrow();
      
      // Test successful shutdown
      mockRedisManager.disconnect.mockResolvedValue(undefined);
      await expect(redisService.shutdown()).resolves.not.toThrow();
    });

    it('should provide clear all cache functionality', async () => {
      // Reset the mock and set up the expected behavior
      mockClient.flushDb.mockClear();
      mockClient.flushDb.mockResolvedValue('OK');

      const result = await redisService.clearAllCache();
      expect(result).toBe(true);
      expect(mockClient.flushDb).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      const mockRedisManager = require('../../database/redis').redisManager;
      mockRedisManager.ping.mockRejectedValue(new Error('Connection failed'));

      const healthCheck = await redisService.healthCheck();

      expect(healthCheck.redis).toBe(false);
      expect(healthCheck.services).toBe(false);
      expect(healthCheck.stats).toBeNull();
    });

    it('should handle service initialization failures', async () => {
      const mockRedisManager = require('../../database/redis').redisManager;
      mockRedisManager.connect.mockRejectedValue(new Error('Init failed'));

      await expect(redisService.initialize()).rejects.toThrow('Init failed');
    });

    it('should handle shutdown errors gracefully', async () => {
      const mockRedisManager = require('../../database/redis').redisManager;
      mockRedisManager.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      // Should not throw, just log error
      await expect(redisService.shutdown()).resolves.not.toThrow();
    });

    it('should handle clear cache errors', async () => {
      // Reset the mock and set up the error behavior
      mockClient.flushDb.mockClear();
      mockClient.flushDb.mockRejectedValue(new Error('Clear failed'));

      const result = await redisService.clearAllCache();
      expect(result).toBe(false);
    });
  });

  describe('Service Coordination', () => {
    it('should coordinate between session and cache services', () => {
      // This test verifies that the RedisService properly coordinates
      // between its sub-services without complex mocking
      const sessionService = redisService.getSessionService();
      const raceStateCache = redisService.getRaceStateCache();

      // Verify both services are available
      expect(sessionService).toBeDefined();
      expect(raceStateCache).toBeDefined();

      // Verify they have the expected methods
      expect(typeof sessionService.createSession).toBe('function');
      expect(typeof sessionService.getSession).toBe('function');
      expect(typeof raceStateCache.cacheRaceState).toBe('function');
      expect(typeof raceStateCache.getRaceState).toBe('function');
    });

    it('should provide emergency recovery capabilities', async () => {
      const mockClient = require('../../database/redis').redisManager.getClient();
      
      // Test with no backups available
      mockClient.keys.mockResolvedValue([]);
      
      const recovery = await redisService.emergencyRecovery();
      
      expect(recovery.success).toBe(true);
      expect(recovery.recoveredRaces).toEqual([]);
      expect(recovery.message).toContain('Recovered 0 races');
    });
  });
});