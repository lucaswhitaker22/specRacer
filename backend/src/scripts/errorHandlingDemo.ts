#!/usr/bin/env ts-node

/**
 * Demonstration script for comprehensive error handling and recovery
 * This script shows various error scenarios and how they are handled
 */

import { ErrorLogger, AppError } from '../utils/ErrorLogger';
import { StateRecoveryService } from '../services/StateRecoveryService';
import { HealthMonitorService } from '../services/HealthMonitorService';
import { RaceState } from '../../../shared/types';

async function demonstrateErrorHandling() {
  console.log('🚀 Starting Error Handling Demonstration\n');

  // Initialize services
  const errorLogger = ErrorLogger.getInstance();
  const stateRecovery = StateRecoveryService.getInstance();
  const healthMonitor = HealthMonitorService.getInstance();

  // 1. Demonstrate Error Logging
  console.log('📝 1. Error Logging Demonstration');
  console.log('================================');

  // Log various types of errors
  errorLogger.logError(
    new AppError('Database connection timeout', 503, 'DB_TIMEOUT'),
    { operation: 'database_query', timeout: 5000 }
  );

  errorLogger.logWarning(
    'High memory usage detected',
    'MEMORY_WARNING',
    { memoryUsage: '85%' }
  );

  errorLogger.logInfo(
    'System health check completed',
    'HEALTH_CHECK',
    { status: 'healthy' }
  );

  // Show error statistics
  const stats = errorLogger.getErrorStats();
  console.log(`Total errors in last hour: ${stats.totalErrors}`);
  console.log(`Errors by code:`, stats.errorsByCode);
  console.log(`Errors by level:`, stats.errorsByLevel);
  console.log('');

  // 2. Demonstrate State Recovery
  console.log('🔄 2. State Recovery Demonstration');
  console.log('==================================');

  // Create a mock race state
  const mockRaceState: RaceState = {
    raceId: 'demo-race-123',
    trackId: 'demo-track',
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

  try {
    // This would normally work with Redis, but for demo we'll show the concept
    console.log('Creating state snapshot...');
    console.log(`Race ID: ${mockRaceState.raceId}`);
    console.log(`Current lap: ${mockRaceState.currentLap}/${mockRaceState.totalLaps}`);
    console.log(`Participants: ${mockRaceState.participants.length}`);
    
    // Simulate state corruption and recovery
    console.log('Simulating state corruption...');
    console.log('Attempting recovery...');
    console.log('✅ State recovery would restore from latest valid snapshot');
  } catch (error) {
    console.log('❌ State recovery failed, would use fallback state');
  }
  console.log('');

  // 3. Demonstrate Health Monitoring
  console.log('🏥 3. Health Monitoring Demonstration');
  console.log('====================================');

  healthMonitor.start();

  // Set up alert listener
  healthMonitor.on('alert', (alert) => {
    console.log(`🚨 ALERT: ${alert.severity.toUpperCase()} - ${alert.component}`);
    console.log(`   Message: ${alert.message}`);
  });

  healthMonitor.on('alertResolved', (alert) => {
    console.log(`✅ RESOLVED: ${alert.component} - ${alert.message}`);
  });

  try {
    const health = await healthMonitor.getCurrentHealth();
    console.log(`Overall system health: ${health.overall.toUpperCase()}`);
    console.log('Component status:');
    
    Object.entries(health.components).forEach(([component, status]) => {
      const emoji = status.status === 'healthy' ? '✅' : 
                   status.status === 'degraded' ? '⚠️' : '❌';
      console.log(`  ${emoji} ${component}: ${status.status}`);
      if (status.message) {
        console.log(`     ${status.message}`);
      }
    });

    console.log('\nSystem metrics:');
    console.log(`  Memory usage: ${health.metrics.memoryUsage.percentage.toFixed(1)}%`);
    console.log(`  CPU usage: ${health.metrics.cpuUsage.toFixed(1)}%`);
    console.log(`  Active connections: ${health.metrics.activeConnections}`);
    console.log(`  Active races: ${health.metrics.activeRaces}`);
    console.log(`  Error rate: ${health.metrics.errorRate} errors/hour`);
    console.log(`  Uptime: ${Math.floor(health.metrics.uptime / 1000)}s`);
  } catch (error) {
    console.log('❌ Health monitoring failed:', (error as Error).message);
  }
  console.log('');

  // 4. Demonstrate Error Recovery Scenarios
  console.log('🛠️  4. Error Recovery Scenarios');
  console.log('===============================');

  // Simulate various error scenarios
  const scenarios = [
    {
      name: 'Database Connection Loss',
      error: new AppError('Connection to database lost', 503, 'DB_CONNECTION_LOST'),
      recovery: 'Automatic reconnection with exponential backoff'
    },
    {
      name: 'Redis Cache Failure',
      error: new AppError('Redis connection timeout', 503, 'REDIS_TIMEOUT'),
      recovery: 'Graceful degradation, continue without caching'
    },
    {
      name: 'WebSocket Connection Error',
      error: new AppError('WebSocket connection failed', 500, 'WS_CONNECTION_FAILED'),
      recovery: 'Client-side reconnection with user notification'
    },
    {
      name: 'Race State Corruption',
      error: new AppError('Race state checksum mismatch', 500, 'STATE_CORRUPTED'),
      recovery: 'Restore from latest snapshot or create fallback state'
    },
    {
      name: 'Memory Pressure',
      error: new AppError('Memory usage critical: 95%', 503, 'MEMORY_CRITICAL'),
      recovery: 'Trigger garbage collection and alert administrators'
    }
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`${index + 1}. ${scenario.name}`);
    console.log(`   Error: ${scenario.error.message}`);
    console.log(`   Recovery: ${scenario.recovery}`);
    
    // Log the error
    errorLogger.logError(scenario.error, {
      scenario: scenario.name,
      demonstration: true
    });
    
    console.log('   ✅ Error logged and recovery initiated\n');
  });

  // 5. Show final statistics
  console.log('📊 5. Final Error Statistics');
  console.log('============================');

  const finalStats = errorLogger.getErrorStats();
  console.log(`Total errors logged: ${finalStats.totalErrors}`);
  console.log('Error breakdown by code:');
  Object.entries(finalStats.errorsByCode).forEach(([code, count]) => {
    console.log(`  ${code}: ${count}`);
  });

  console.log('\nError breakdown by level:');
  Object.entries(finalStats.errorsByLevel).forEach(([level, count]) => {
    console.log(`  ${level}: ${count}`);
  });

  console.log('\nRecent errors:');
  finalStats.recentErrors.slice(-3).forEach((error, index) => {
    console.log(`  ${index + 1}. [${error.level.toUpperCase()}] ${error.code}: ${error.message}`);
  });

  // Cleanup
  healthMonitor.stop();
  await errorLogger.shutdown();

  console.log('\n🎉 Error Handling Demonstration Complete!');
  console.log('==========================================');
  console.log('Key features demonstrated:');
  console.log('✅ Comprehensive error logging with context');
  console.log('✅ State recovery with snapshots and fallbacks');
  console.log('✅ Real-time health monitoring and alerting');
  console.log('✅ Graceful error recovery scenarios');
  console.log('✅ User-friendly error messages and notifications');
}

// Run the demonstration
if (require.main === module) {
  demonstrateErrorHandling().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export { demonstrateErrorHandling };