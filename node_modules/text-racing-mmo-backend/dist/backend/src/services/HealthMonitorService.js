"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitorService = void 0;
const events_1 = require("events");
const connection_1 = require("../database/connection");
const RedisService_1 = require("./RedisService");
const ErrorLogger_1 = require("../utils/ErrorLogger");
class HealthMonitorService extends events_1.EventEmitter {
    constructor() {
        super();
        this.monitoringInterval = null;
        this.healthHistory = [];
        this.activeAlerts = new Map();
        this.maxHistorySize = 1000;
        this.checkInterval = 30000;
        this.startTime = Date.now();
        this.logger = ErrorLogger_1.ErrorLogger.getInstance();
    }
    static getInstance() {
        if (!HealthMonitorService.instance) {
            HealthMonitorService.instance = new HealthMonitorService();
        }
        return HealthMonitorService.instance;
    }
    start() {
        if (this.monitoringInterval) {
            return;
        }
        this.logger.logInfo('Starting health monitoring', 'HEALTH_MONITOR_START');
        this.monitoringInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.checkInterval);
        this.performHealthCheck();
    }
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.logger.logInfo('Stopped health monitoring', 'HEALTH_MONITOR_STOP');
    }
    async getCurrentHealth() {
        return await this.checkSystemHealth();
    }
    getHealthHistory(limit = 100) {
        return this.healthHistory.slice(-limit);
    }
    getActiveAlerts() {
        return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
    }
    async getSystemMetrics() {
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
    resolveAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (alert) {
            alert.resolved = true;
            this.emit('alertResolved', alert);
            return true;
        }
        return false;
    }
    async performHealthCheck() {
        try {
            const health = await this.checkSystemHealth();
            this.healthHistory.push(health);
            if (this.healthHistory.length > this.maxHistorySize) {
                this.healthHistory.shift();
            }
            this.checkForAlerts(health);
            this.emit('healthUpdate', health);
            if (health.overall !== 'healthy') {
                this.logger.logWarning(`System health is ${health.overall}`, 'SYSTEM_HEALTH_DEGRADED', { health });
            }
        }
        catch (error) {
            this.logger.logError(error, {
                operation: 'health_check'
            });
        }
    }
    async checkSystemHealth() {
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
        const componentStatuses = Object.values(components).map(c => c.status);
        let overall = 'healthy';
        if (componentStatuses.includes('critical')) {
            overall = 'critical';
        }
        else if (componentStatuses.includes('degraded')) {
            overall = 'degraded';
        }
        return {
            overall,
            timestamp,
            components,
            metrics
        };
    }
    async checkDatabaseHealth() {
        const startTime = Date.now();
        try {
            const db = (0, connection_1.getDatabaseConnection)();
            await db.query('SELECT 1');
            const responseTime = Date.now() - startTime;
            return {
                status: responseTime < 1000 ? 'healthy' : 'degraded',
                responseTime,
                lastCheck: Date.now()
            };
        }
        catch (error) {
            this.logger.logError(error, {
                operation: 'database_health_check'
            });
            return {
                status: 'critical',
                responseTime: Date.now() - startTime,
                lastCheck: Date.now(),
                message: error.message
            };
        }
    }
    async checkRedisHealth() {
        const startTime = Date.now();
        try {
            const health = await RedisService_1.redisService.healthCheck();
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
        }
        catch (error) {
            return {
                status: 'critical',
                responseTime: Date.now() - startTime,
                lastCheck: Date.now(),
                message: error.message
            };
        }
    }
    async checkWebSocketHealth() {
        try {
            return {
                status: 'healthy',
                lastCheck: Date.now()
            };
        }
        catch (error) {
            return {
                status: 'critical',
                lastCheck: Date.now(),
                message: error.message
            };
        }
    }
    async checkMemoryHealth() {
        const memoryUsage = process.memoryUsage();
        const percentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        let status = 'healthy';
        if (percentage > 90) {
            status = 'critical';
        }
        else if (percentage > 75) {
            status = 'degraded';
        }
        return {
            status,
            lastCheck: Date.now(),
            message: `Memory usage: ${percentage.toFixed(1)}%`
        };
    }
    async checkCpuHealth() {
        const cpuUsage = await this.getCpuUsage();
        let status = 'healthy';
        if (cpuUsage > 90) {
            status = 'critical';
        }
        else if (cpuUsage > 75) {
            status = 'degraded';
        }
        return {
            status,
            lastCheck: Date.now(),
            message: `CPU usage: ${cpuUsage.toFixed(1)}%`
        };
    }
    async getCpuUsage() {
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
    async getActiveConnectionCount() {
        try {
            return 0;
        }
        catch (error) {
            return 0;
        }
    }
    async getActiveRaceCount() {
        try {
            const keys = await RedisService_1.redisService.getKeys('race_state:*');
            return keys.length;
        }
        catch (error) {
            return 0;
        }
    }
    checkForAlerts(health) {
        for (const [componentName, component] of Object.entries(health.components)) {
            const alertId = `${componentName}_${component.status}`;
            if (component.status === 'critical') {
                if (!this.activeAlerts.has(alertId)) {
                    const alert = {
                        id: alertId,
                        timestamp: Date.now(),
                        severity: 'critical',
                        component: componentName,
                        message: component.message || `${componentName} is in critical state`,
                        resolved: false
                    };
                    this.activeAlerts.set(alertId, alert);
                    this.emit('alert', alert);
                    this.logger.logError(new Error(alert.message), { alertId, component: componentName });
                }
            }
            else if (component.status === 'degraded') {
                if (!this.activeAlerts.has(alertId)) {
                    const alert = {
                        id: alertId,
                        timestamp: Date.now(),
                        severity: 'warning',
                        component: componentName,
                        message: component.message || `${componentName} is degraded`,
                        resolved: false
                    };
                    this.activeAlerts.set(alertId, alert);
                    this.emit('alert', alert);
                    this.logger.logWarning(alert.message, 'COMPONENT_DEGRADED', { alertId, component: componentName });
                }
            }
            else if (component.status === 'healthy') {
                const existingAlert = this.activeAlerts.get(alertId);
                if (existingAlert && !existingAlert.resolved) {
                    existingAlert.resolved = true;
                    this.emit('alertResolved', existingAlert);
                }
            }
        }
        if (health.metrics.memoryUsage.percentage > 90) {
            const alertId = 'memory_critical';
            if (!this.activeAlerts.has(alertId)) {
                const alert = {
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
        if (health.metrics.errorRate > 100) {
            const alertId = 'error_rate_high';
            if (!this.activeAlerts.has(alertId)) {
                const alert = {
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
exports.HealthMonitorService = HealthMonitorService;
//# sourceMappingURL=HealthMonitorService.js.map