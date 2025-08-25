import { EventEmitter } from 'events';
import { getDatabaseConnection } from '../database/connection';
import { redisService } from './RedisService';
import { ErrorLogger } from '../utils/ErrorLogger';

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  timestamp: number;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    websocket: ComponentHealth;
    memory: ComponentHealth;
    cpu: ComponentHealth;
  };
  metrics: SystemMetrics;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  responseTime?: number;
  errorRate?: number;
  lastCheck: number;
  message?: string;
}

export interface SystemMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  activeConnections: number;
  activeRaces: number;
  errorRate: number;
  uptime: number;
}

export interface HealthAlert {
  id: string;
  timestamp: number;
  severity: 'warning' | 'critical';
  component: string;
  message: string;
  resolved: boolean;
}

/**
 * System health monitoring and alerting service
 */
export class HealthMonitorService extends EventEmitter {
  private static instance: HealthMonitorService;
  private logger: ErrorLogger;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthHistory: SystemHealth[] = [];
  private activeAlerts = new Map<string, HealthAlert>();
  private readonly maxHistorySize = 1000;
  private readonly checkInterval = 30000; // 30 seconds
  private startTime = Date.now();

  private constructor() {
    super();
    this.logger = ErrorLogger.getInstance();
  }

  public static getInstance(): HealthMonitorService {
    if (!HealthMonitorService.instance) {
      HealthMonitorService.instance = new HealthMonitorService();
    }
    return HealthMonitorService.instance;
  }

  /**
   * Start health monitoring
   */
  public start(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.logger.logInfo('Starting health monitoring', 'HEALTH_MONITOR_START');
    
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.checkInterval);

    // Perform initial check
    this.performHealthCheck();
  }

  /**
   * Stop health monitoring
   */
  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.logger.logInfo('Stopped health monitoring', 'HEALTH_MONITOR_STOP');
  }

  /**
   * Get current system health
   */
  public async getCurrentHealth(): Promise<SystemHealth> {
    return await this.checkSystemHealth();
  }

  /**
   * Get health history
   */
  public getHealthHistory(limit: number = 100): SystemHealth[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get system metrics
   */
  public async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const errorStats = this.logger.getErrorStats();
    
    return {
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      cpuUsage: await this.getCpuUsage(),
      activeConnections: await this.getActiveConnectionCount(),
      activeRaces: await this.getActiveRaceCount(),
      errorRate: errorStats.totalErrors,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.checkSystemHealth();
      
      // Store in history
      this.healthHistory.push(health);
      if (this.healthHistory.length > this.maxHistorySize) {
        this.healthHistory.shift();
      }

      // Check for alerts
      this.checkForAlerts(health);

      // Emit health update
      this.emit('healthUpdate', health);

      // Log if system is degraded or critical
      if (health.overall !== 'healthy') {
        this.logger.logWarning(
          `System health is ${health.overall}`,
          'SYSTEM_HEALTH_DEGRADED',
          { health }
        );
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        operation: 'health_check'
      });
    }
  }

  private async checkSystemHealth(): Promise<SystemHealth> {
    const timestamp = Date.now();
    
    const [database, redis, websocket, memory, cpu] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkWebSocketHealth(),
      this.checkMemoryHealth(),
      this.checkCpuHealth()
    ]);

    const components = { database, redis, websocket, memory, cpu };
    const metrics = await this.getSystemMetrics();

    // Determine overall health
    const componentStatuses = Object.values(components).map(c => c.status);
    let overall: SystemHealth['overall'] = 'healthy';
    
    if (componentStatuses.includes('critical')) {
      overall = 'critical';
    } else if (componentStatuses.includes('degraded')) {
      overall = 'degraded';
    }

    return {
      overall,
      timestamp,
      components,
      metrics
    };
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const db = getDatabaseConnection();
      await db.query('SELECT 1');
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: Date.now()
      };
    } catch (error) {
      this.logger.logError(error as Error, {
        operation: 'database_health_check'
      });
      
      return {
        status: 'critical',
        responseTime: Date.now() - startTime,
        lastCheck: Date.now(),
        message: (error as Error).message
      };
    }
  }

  private async checkRedisHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const health = await redisService.healthCheck();
      const responseTime = Date.now() - startTime;
      
      if (!health.redis) {
        return {
          status: 'critical',
          responseTime,
          lastCheck: Date.now(),
          message: 'Redis connection failed'
        };
      }
      
      return {
        status: health.services ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        status: 'critical',
        responseTime: Date.now() - startTime,
        lastCheck: Date.now(),
        message: (error as Error).message
      };
    }
  }

  private async checkWebSocketHealth(): Promise<ComponentHealth> {
    try {
      // This would need to be implemented with actual WebSocket server reference
      // For now, return a basic health check
      return {
        status: 'healthy',
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        status: 'critical',
        lastCheck: Date.now(),
        message: (error as Error).message
      };
    }
  }

  private async checkMemoryHealth(): Promise<ComponentHealth> {
    const memoryUsage = process.memoryUsage();
    const percentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    let status: ComponentHealth['status'] = 'healthy';
    if (percentage > 90) {
      status = 'critical';
    } else if (percentage > 75) {
      status = 'degraded';
    }
    
    return {
      status,
      lastCheck: Date.now(),
      message: `Memory usage: ${percentage.toFixed(1)}%`
    };
  }

  private async checkCpuHealth(): Promise<ComponentHealth> {
    const cpuUsage = await this.getCpuUsage();
    
    let status: ComponentHealth['status'] = 'healthy';
    if (cpuUsage > 90) {
      status = 'critical';
    } else if (cpuUsage > 75) {
      status = 'degraded';
    }
    
    return {
      status,
      lastCheck: Date.now(),
      message: `CPU usage: ${cpuUsage.toFixed(1)}%`
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const elapsedTime = Date.now() - startTime;
        
        const totalUsage = currentUsage.user + currentUsage.system;
        const percentage = (totalUsage / (elapsedTime * 1000)) * 100;
        
        resolve(Math.min(percentage, 100));
      }, 100);
    });
  }

  private async getActiveConnectionCount(): Promise<number> {
    try {
      // This would need to be implemented with actual connection manager
      return 0;
    } catch (error) {
      return 0;
    }
  }

  private async getActiveRaceCount(): Promise<number> {
    try {
      const keys = await redisService.getKeys('race_state:*');
      return keys.length;
    } catch (error) {
      return 0;
    }
  }

  private checkForAlerts(health: SystemHealth): void {
    // Check for critical components
    for (const [componentName, component] of Object.entries(health.components)) {
      const alertId = `${componentName}_${component.status}`;
      
      if (component.status === 'critical') {
        if (!this.activeAlerts.has(alertId)) {
          const alert: HealthAlert = {
            id: alertId,
            timestamp: Date.now(),
            severity: 'critical',
            component: componentName,
            message: component.message || `${componentName} is in critical state`,
            resolved: false
          };
          
          this.activeAlerts.set(alertId, alert);
          this.emit('alert', alert);
          
          this.logger.logError(
            new Error(alert.message),
            { alertId, component: componentName }
          );
        }
      } else if (component.status === 'degraded') {
        if (!this.activeAlerts.has(alertId)) {
          const alert: HealthAlert = {
            id: alertId,
            timestamp: Date.now(),
            severity: 'warning',
            component: componentName,
            message: component.message || `${componentName} is degraded`,
            resolved: false
          };
          
          this.activeAlerts.set(alertId, alert);
          this.emit('alert', alert);
          
          this.logger.logWarning(
            alert.message,
            'COMPONENT_DEGRADED',
            { alertId, component: componentName }
          );
        }
      } else if (component.status === 'healthy') {
        // Resolve any existing alerts for this component
        const existingAlert = this.activeAlerts.get(alertId);
        if (existingAlert && !existingAlert.resolved) {
          existingAlert.resolved = true;
          this.emit('alertResolved', existingAlert);
        }
      }
    }

    // Check memory usage
    if (health.metrics.memoryUsage.percentage > 90) {
      const alertId = 'memory_critical';
      if (!this.activeAlerts.has(alertId)) {
        const alert: HealthAlert = {
          id: alertId,
          timestamp: Date.now(),
          severity: 'critical',
          component: 'memory',
          message: `Memory usage critical: ${health.metrics.memoryUsage.percentage.toFixed(1)}%`,
          resolved: false
        };
        
        this.activeAlerts.set(alertId, alert);
        this.emit('alert', alert);
      }
    }

    // Check error rate
    if (health.metrics.errorRate > 100) { // More than 100 errors in the last hour
      const alertId = 'error_rate_high';
      if (!this.activeAlerts.has(alertId)) {
        const alert: HealthAlert = {
          id: alertId,
          timestamp: Date.now(),
          severity: 'warning',
          component: 'errors',
          message: `High error rate: ${health.metrics.errorRate} errors in the last hour`,
          resolved: false
        };
        
        this.activeAlerts.set(alertId, alert);
        this.emit('alert', alert);
      }
    }
  }
}