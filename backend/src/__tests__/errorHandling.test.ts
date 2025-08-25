import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ErrorLogger, AppError } from '../utils/ErrorLogger';
import { StateRecoveryService } from '../services/StateRecoveryService';
import { HealthMonitorService } from '../services/HealthMonitorService';
import { redisService } from '../services/RedisService';
import { RaceState } from '../../../shared/types';

// Mock dependencies
jest.mock('../services/RedisService', () => ({
  redisService: {
    getRaceState: jest.fn(),
    setRaceState: jest.fn(),
    setWithExpiry: jest.fn(),
    listPush: jest.fn(),
    listRange: jest.fn(),
    get: jest.fn(),
    healthCheck: jest.fn(),
    getKeys: jest.fn()
  }
}));
jest.mock('../database/connection');

describe('Error Handling and Recovery', () => {
  let errorLogger: ErrorLogger;
  let stateRecovery: StateRecoveryService;
  let healthMonitor: HealthMonitorService;

  beforeEach(() => {
    errorLogger = ErrorLogger.getInstance();
    stateRecovery = StateRecoveryService.getInstance();
    healthMonitor = HealthMonitorService.getInstance();
    
    // Clear any existing logs/state
    jest.clearAllMocks();
  });

  afterEach(async () => {
    healthMonitor.stop();
    await errorLogger.shutdown();
  });

  describe('ErrorLogger', () => {
    it('should log errors with context', () => {
      const error = new Error('Test error');
      const context = { requestId: 'test-123', operation: 'test' };

      errorLogger.logError(error, context);

      const recentLogs = errorLogger.getRecentLogs(1);
      expect(recentLogs).toHaveLength(1);
      expect(recentLogs[0].message).toBe('Test error');
      expect(recentLogs[0].context).toEqual(context);
    });

    it('should handle AppError with custom codes', () => {
      const appError = new AppError(
        'Custom error',
        400,
        'CUSTOM_ERROR',
        { detail: 'test' }
      );

      errorLogger.logError(appError);

      const recentLogs = errorLogger.getRecentLogs(1);
      expect(recentLogs[0].code).toBe('CUSTOM_ERROR');
    });

    it('should provide error statistics', () => {
      // Log multiple errors
      errorLogger.logError(new AppError('Error 1', 400, 'ERROR_1'));
      errorLogger.logError(new AppError('Error 2', 500, 'ERROR_2'));
      errorLogger.logError(new AppError('Error 1 again', 400, 'ERROR_1'));

      const stats = errorLogger.getErrorStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCode['ERROR_1']).toBe(2);
      expect(stats.errorsByCode['ERROR_2']).toBe(1);
    });

    it('should limit buffer size', () => {
      // Log more than buffer size
      for (let i = 0; i < 1100; i++) {
        errorLogger.logError(new Error(`Error ${i}`));
      }

      const recentLogs = errorLogger.getRecentLogs();
      expect(recentLogs.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('StateRecoveryService', () => {
    const mockRaceState: RaceState = {
      raceId: 'test-race-123',
      trackId: 'test-track',
      currentLap: 5,
      totalLaps: 10,
      raceTime: 300,
      participants: [
        {
          playerId: 'player-1',
          carId: 'car-1',
          position: 1,
          lapTime: 60,
          totalTime: 300,
          fuel: 75,
          tireWear: { front: 20, rear: 25 },
          speed: 120,
          location: { lap: 5, sector: 2, distance: 1500 },
          lastCommand: 'accelerate',
          commandTimestamp: Date.now()
        }
      ],
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

    beforeEach(() => {
      // Mock Redis service methods
      (redisService.getRaceState as jest.Mock).mockResolvedValue(mockRaceState);
      (redisService.setWithExpiry as jest.Mock).mockResolvedValue(true);
      (redisService.listPush as jest.Mock).mockResolvedValue(1);
      (redisService.listRange as jest.Mock).mockResolvedValue(['snapshot-1']);
      (redisService.get as jest.Mock).mockResolvedValue(JSON.stringify({
        id: 'snapshot-1',
        raceId: 'test-race-123',
        timestamp: Date.now(),
        raceState: mockRaceState,
        checksum: 'test-checksum'
      }));
    });

    it('should create state snapshots', async () => {
      const snapshotId = await stateRecovery.createStateSnapshot('test-race-123');
      
      expect(snapshotId).toBeDefined();
      expect(redisService.getRaceState).toHaveBeenCalledWith('test-race-123');
      expect(redisService.setWithExpiry).toHaveBeenCalled();
    });

    it('should recover race state from snapshots', async () => {
      const result = await stateRecovery.recoverRaceState('test-race-123');
      
      expect(result.success).toBe(true);
      expect(result.recoveredState).toBeDefined();
      expect(result.recoveredState?.raceId).toBe('test-race-123');
    });

    it('should handle snapshot corruption', async () => {
      // Mock corrupted snapshot
      (redisService.get as jest.Mock).mockResolvedValue(JSON.stringify({
        id: 'corrupted-snapshot',
        raceId: 'test-race-123',
        timestamp: Date.now(),
        raceState: { invalid: 'data' },
        checksum: 'wrong-checksum'
      }));

      const result = await stateRecovery.recoverRaceState('test-race-123');
      
      // Should fall back to database state
      expect(result.success).toBe(true);
      expect(result.fallbackState).toBeDefined();
    });

    it('should rollback to specific snapshot', async () => {
      const result = await stateRecovery.rollbackToSnapshot('test-race-123', 'snapshot-1');
      
      expect(result.success).toBe(true);
      expect(result.recoveredState).toBeDefined();
    });

    it('should handle missing snapshots', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      
      const result = await stateRecovery.rollbackToSnapshot('test-race-123', 'missing-snapshot');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('HealthMonitorService', () => {
    it('should start and stop monitoring', () => {
      expect(() => {
        healthMonitor.start();
        healthMonitor.stop();
      }).not.toThrow();
    });

    it('should get current health status', async () => {
      const health = await healthMonitor.getCurrentHealth();
      
      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('components');
      expect(health).toHaveProperty('metrics');
      
      expect(health.components).toHaveProperty('database');
      expect(health.components).toHaveProperty('redis');
      expect(health.components).toHaveProperty('memory');
    });

    it('should track health history', async () => {
      healthMonitor.start();
      
      // Wait for a health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const history = healthMonitor.getHealthHistory(10);
      expect(Array.isArray(history)).toBe(true);
    });

    it('should generate alerts for critical components', async () => {
      let alertReceived = false;
      
      healthMonitor.on('alert', (alert) => {
        alertReceived = true;
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('component');
        expect(alert).toHaveProperty('message');
      });

      // Mock critical database health
      jest.spyOn(healthMonitor as any, 'checkDatabaseHealth').mockResolvedValue({
        status: 'critical',
        lastCheck: Date.now(),
        message: 'Database connection failed'
      });

      healthMonitor.start();
      
      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(alertReceived).toBe(true);
    });

    it('should resolve alerts when components recover', async () => {
      let alertResolved = false;
      
      healthMonitor.on('alertResolved', (alert) => {
        alertResolved = true;
      });

      // First create an alert
      jest.spyOn(healthMonitor as any, 'checkDatabaseHealth')
        .mockResolvedValueOnce({
          status: 'critical',
          lastCheck: Date.now(),
          message: 'Database connection failed'
        })
        .mockResolvedValueOnce({
          status: 'healthy',
          lastCheck: Date.now()
        });

      healthMonitor.start();
      
      // Wait for health checks
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(alertResolved).toBe(true);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle database connection loss', async () => {
      // Mock database connection failure
      const mockDb = {
        query: jest.fn().mockRejectedValue(new Error('Connection lost'))
      } as any;

      // Test that error is logged and handled gracefully
      try {
        await mockDb.query('SELECT 1');
      } catch (error) {
        errorLogger.logError(error as Error, { operation: 'database_query' });
      }

      const recentLogs = errorLogger.getRecentLogs(1);
      expect(recentLogs[0].message).toBe('Connection lost');
    });

    it('should handle Redis connection loss', async () => {
      // Mock Redis connection failure
      (redisService.healthCheck as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed')
      );

      const health = await healthMonitor.getCurrentHealth();
      
      expect(health.components.redis.status).toBe('critical');
    });

    it('should handle WebSocket connection errors', () => {
      const mockSocket = {
        emit: jest.fn(),
        on: jest.fn(),
        disconnect: jest.fn()
      };

      // Simulate connection error
      const error = new Error('WebSocket connection failed');
      errorLogger.logError(error, { 
        socketId: 'test-socket',
        operation: 'websocket_connection' 
      });

      const recentLogs = errorLogger.getRecentLogs(1);
      expect(recentLogs[0].context?.operation).toBe('websocket_connection');
    });

    it('should handle race state corruption', async () => {
      const raceId = 'corrupted-race-123';
      
      // Mock corrupted state
      (redisService.getRaceState as jest.Mock).mockResolvedValue(null);
      
      const result = await stateRecovery.recoverRaceState(raceId);
      
      // Should attempt fallback recovery
      expect(result.success).toBe(true);
      expect(result.fallbackState).toBeDefined();
    });

    it('should handle memory pressure', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 950 * 1024 * 1024, // 950MB
        heapTotal: 1000 * 1024 * 1024, // 1GB
        external: 0,
        arrayBuffers: 0,
        rss: 1000 * 1024 * 1024
      }) as any;

      const health = await healthMonitor.getCurrentHealth();
      
      expect(health.components.memory.status).toBe('critical');
      
      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Error Propagation and User Feedback', () => {
    it('should create user-friendly error messages', () => {
      const appError = new AppError(
        'Database connection timeout',
        503,
        'DB_TIMEOUT',
        { timeout: 5000 }
      );

      expect(appError.message).toBe('Database connection timeout');
      expect(appError.statusCode).toBe(503);
      expect(appError.code).toBe('DB_TIMEOUT');
      expect(appError.isOperational).toBe(true);
    });

    it('should handle validation errors', () => {
      const validationError = new AppError(
        'Invalid car selection',
        400,
        'VALIDATION_ERROR',
        { field: 'carId', value: 'invalid-car' }
      );

      errorLogger.logError(validationError);

      const recentLogs = errorLogger.getRecentLogs(1);
      expect(recentLogs[0].code).toBe('VALIDATION_ERROR');
    });

    it('should handle authentication errors', () => {
      const authError = new AppError(
        'Invalid authentication token',
        401,
        'AUTH_INVALID',
        { token: 'expired' }
      );

      errorLogger.logError(authError);

      const recentLogs = errorLogger.getRecentLogs(1);
      expect(recentLogs[0].code).toBe('AUTH_INVALID');
    });
  });
});