import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import { WebSocketServer } from '../websocket/WebSocketServer';
import { errorHandler, notFoundHandler, asyncHandler } from '../middleware/errorHandler';
import { AppError, ErrorLogger } from '../utils/ErrorLogger';
import { StateRecoveryService } from '../services/StateRecoveryService';
import { HealthMonitorService } from '../services/HealthMonitorService';
import { redisService } from '../services/RedisService';
import { RaceState } from '../../../shared/types';

// Mock dependencies
jest.mock('../services/RedisService');
jest.mock('../database/connection');

describe('Error Handling Integration Tests', () => {
  let app: express.Application;
  let server: Server;
  let wsServer: WebSocketServer;
  let errorLogger: ErrorLogger;
  let stateRecovery: StateRecoveryService;
  let healthMonitor: HealthMonitorService;

  beforeAll(async () => {
    // Set up Express app with error handling
    app = express();
    app.use(express.json());

    // Test routes
    app.get('/test/success', (req, res) => {
      res.json({ message: 'success' });
    });

    app.get('/test/error', asyncHandler(async (req, res) => {
      throw new AppError('Test error', 400, 'TEST_ERROR');
    }));

    app.get('/test/async-error', asyncHandler(async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      throw new Error('Async error');
    }));

    app.get('/test/validation-error', (req, res, next) => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      next(error);
    });

    // Add error handling middleware
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Start server
    server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 3000;

    // Initialize WebSocket server
    wsServer = new WebSocketServer(server);

    // Initialize services
    errorLogger = ErrorLogger.getInstance();
    stateRecovery = StateRecoveryService.getInstance();
    healthMonitor = HealthMonitorService.getInstance();
  });

  afterAll(async () => {
    await wsServer.shutdown();
    await healthMonitor.stop();
    await errorLogger.shutdown();
    server.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP Error Handling', () => {
    it('should handle successful requests', async () => {
      const response = await request(app)
        .get('/test/success')
        .expect(200);

      expect(response.body.message).toBe('success');
    });

    it('should handle AppError with proper status code', async () => {
      const response = await request(app)
        .get('/test/error')
        .expect(400);

      expect(response.body.error.message).toBe('Test error');
      expect(response.body.error.code).toBe('TEST_ERROR');
      expect(response.body.error.timestamp).toBeDefined();
    });

    it('should handle async errors', async () => {
      const response = await request(app)
        .get('/test/async-error')
        .expect(500);

      expect(response.body.error.message).toBe('An internal server error occurred');
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .get('/test/validation-error')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid request data');
    });

    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Route GET /nonexistent-route not found');
    });

    it('should include request ID in error responses', async () => {
      const response = await request(app)
        .get('/test/error')
        .set('x-request-id', 'test-request-123')
        .expect(400);

      expect(response.body.error.requestId).toBe('test-request-123');
    });
  });

  describe('State Recovery Integration', () => {
    const mockRaceState: RaceState = {
      raceId: 'integration-test-race',
      trackId: 'test-track',
      currentLap: 3,
      totalLaps: 10,
      raceTime: 180,
      participants: [
        {
          playerId: 'player-1',
          carId: 'car-1',
          position: 1,
          lapTime: 60,
          totalTime: 180,
          fuel: 80,
          tireWear: { front: 15, rear: 20 },
          speed: 100,
          location: { lap: 3, sector: 1, distance: 500 },
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
      (redisService.setRaceState as jest.Mock).mockResolvedValue(true);
      (redisService.setWithExpiry as jest.Mock).mockResolvedValue(true);
      (redisService.listPush as jest.Mock).mockResolvedValue(1);
      (redisService.listRange as jest.Mock).mockResolvedValue(['snapshot-1']);
      (redisService.get as jest.Mock).mockResolvedValue(JSON.stringify({
        id: 'snapshot-1',
        raceId: 'integration-test-race',
        timestamp: Date.now(),
        raceState: mockRaceState,
        checksum: Buffer.from(JSON.stringify({
          raceId: mockRaceState.raceId,
          currentLap: mockRaceState.currentLap,
          raceTime: mockRaceState.raceTime,
          participantCount: mockRaceState.participants.length,
          participantPositions: mockRaceState.participants.map(p => ({
            id: p.playerId,
            position: p.position,
            totalTime: p.totalTime
          }))
        })).toString('base64')
      }));
    });

    it('should create and recover from snapshots', async () => {
      // Create snapshot
      const snapshotId = await stateRecovery.createStateSnapshot('integration-test-race');
      expect(snapshotId).toBeDefined();

      // Simulate state corruption
      (redisService.getRaceState as jest.Mock).mockResolvedValueOnce(null);

      // Recover state
      const recovery = await stateRecovery.recoverRaceState('integration-test-race');
      expect(recovery.success).toBe(true);
      expect(recovery.recoveredState).toBeDefined();
    });

    it('should handle snapshot corruption gracefully', async () => {
      // Mock corrupted snapshot
      (redisService.get as jest.Mock).mockResolvedValue(JSON.stringify({
        id: 'corrupted-snapshot',
        raceId: 'integration-test-race',
        timestamp: Date.now(),
        raceState: { invalid: 'data' },
        checksum: 'invalid-checksum'
      }));

      const recovery = await stateRecovery.recoverRaceState('integration-test-race');
      
      // Should fall back to database recovery
      expect(recovery.success).toBe(true);
      expect(recovery.fallbackState).toBeDefined();
    });

    it('should handle complete recovery failure', async () => {
      // Mock all recovery methods failing
      (redisService.listRange as jest.Mock).mockResolvedValue([]);
      (redisService.getRaceState as jest.Mock).mockResolvedValue(null);

      // Mock database failure
      const mockDb = {
        query: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      };

      const recovery = await stateRecovery.recoverRaceState('integration-test-race');
      expect(recovery.success).toBe(false);
      expect(recovery.error).toBeDefined();
    });
  });

  describe('Health Monitoring Integration', () => {
    beforeEach(() => {
      healthMonitor.start();
    });

    afterEach(() => {
      healthMonitor.stop();
    });

    it('should monitor system health', async () => {
      const health = await healthMonitor.getCurrentHealth();
      
      expect(health.overall).toMatch(/^(healthy|degraded|critical)$/);
      expect(health.components).toHaveProperty('database');
      expect(health.components).toHaveProperty('redis');
      expect(health.components).toHaveProperty('memory');
      expect(health.metrics).toHaveProperty('memoryUsage');
    });

    it('should generate alerts for critical conditions', (done) => {
      let alertReceived = false;

      healthMonitor.on('alert', (alert) => {
        alertReceived = true;
        expect(alert.severity).toMatch(/^(warning|critical)$/);
        expect(alert.component).toBeDefined();
        expect(alert.message).toBeDefined();
        
        if (!done.mock) {
          done();
        }
      });

      // Mock critical database condition
      jest.spyOn(healthMonitor as any, 'checkDatabaseHealth').mockResolvedValue({
        status: 'critical',
        lastCheck: Date.now(),
        message: 'Database connection timeout'
      });

      // Wait for health check
      setTimeout(() => {
        if (!alertReceived && !done.mock) {
          done();
        }
      }, 100);
    });

    it('should track health history', async () => {
      // Wait for at least one health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const history = healthMonitor.getHealthHistory(5);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Error Logging Integration', () => {
    it('should log errors with context', () => {
      const error = new AppError('Integration test error', 500, 'INTEGRATION_ERROR');
      const context = {
        requestId: 'integration-test-123',
        operation: 'integration_test',
        userId: 'test-user'
      };

      errorLogger.logError(error, context);

      const recentLogs = errorLogger.getRecentLogs(1);
      expect(recentLogs).toHaveLength(1);
      expect(recentLogs[0].message).toBe('Integration test error');
      expect(recentLogs[0].code).toBe('INTEGRATION_ERROR');
      expect(recentLogs[0].context).toEqual(context);
    });

    it('should provide error statistics', () => {
      // Log various errors
      errorLogger.logError(new AppError('Error 1', 400, 'ERROR_1'));
      errorLogger.logError(new AppError('Error 2', 500, 'ERROR_2'));
      errorLogger.logError(new AppError('Error 1 again', 400, 'ERROR_1'));
      errorLogger.logWarning('Warning message', 'WARNING_1');

      const stats = errorLogger.getErrorStats();
      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByCode['ERROR_1']).toBe(2);
      expect(stats.errorsByLevel['error']).toBe(3);
      expect(stats.errorsByLevel['warn']).toBe(1);
    });
  });

  describe('End-to-End Error Scenarios', () => {
    it('should handle cascading failures gracefully', async () => {
      // Simulate database failure
      const mockDb = {
        query: jest.fn().mockRejectedValue(new Error('Database connection lost'))
      };

      // Simulate Redis failure
      (redisService.healthCheck as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed')
      );

      // Health check should detect multiple failures
      const health = await healthMonitor.getCurrentHealth();
      expect(health.overall).toBe('critical');
      expect(health.components.database.status).toBe('critical');
      expect(health.components.redis.status).toBe('critical');
    });

    it('should maintain service availability during partial failures', async () => {
      // Simulate Redis failure but database working
      (redisService.healthCheck as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed')
      );

      // Basic HTTP endpoints should still work
      const response = await request(app)
        .get('/test/success')
        .expect(200);

      expect(response.body.message).toBe('success');

      // Health check should show degraded state
      const health = await healthMonitor.getCurrentHealth();
      expect(health.overall).toBe('degraded');
    });

    it('should recover from temporary failures', async () => {
      // Start with failure
      (redisService.healthCheck as jest.Mock).mockRejectedValueOnce(
        new Error('Temporary Redis failure')
      );

      let health = await healthMonitor.getCurrentHealth();
      expect(health.components.redis.status).toBe('critical');

      // Simulate recovery
      (redisService.healthCheck as jest.Mock).mockResolvedValue({
        redis: true,
        services: true
      });

      health = await healthMonitor.getCurrentHealth();
      expect(health.components.redis.status).toBe('healthy');
    });
  });

  describe('Performance Under Error Conditions', () => {
    it('should handle high error rates without degradation', async () => {
      const startTime = Date.now();
      
      // Generate many errors rapidly
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .get('/test/error')
            .expect(400)
        );
      }

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
      
      // Error logger should handle all errors
      const stats = errorLogger.getErrorStats();
      expect(stats.totalErrors).toBeGreaterThanOrEqual(100);
    });

    it('should maintain memory usage under error load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate many errors
      for (let i = 0; i < 1000; i++) {
        errorLogger.logError(new Error(`Load test error ${i}`));
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});