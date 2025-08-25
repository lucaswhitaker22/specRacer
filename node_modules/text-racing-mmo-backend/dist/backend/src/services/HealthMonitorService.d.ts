import { EventEmitter } from 'events';
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
export declare class HealthMonitorService extends EventEmitter {
    private static instance;
    private logger;
    private monitoringInterval;
    private healthHistory;
    private activeAlerts;
    private readonly maxHistorySize;
    private readonly checkInterval;
    private startTime;
    private constructor();
    static getInstance(): HealthMonitorService;
    start(): void;
    stop(): void;
    getCurrentHealth(): Promise<SystemHealth>;
    getHealthHistory(limit?: number): SystemHealth[];
    getActiveAlerts(): HealthAlert[];
    getSystemMetrics(): Promise<SystemMetrics>;
    resolveAlert(alertId: string): boolean;
    forceCleanup(): void;
    private performHealthCheck;
    private checkSystemHealth;
    private checkDatabaseHealth;
    private checkRedisHealth;
    private checkWebSocketHealth;
    private checkMemoryHealth;
    private checkCpuHealth;
    private getCpuUsage;
    private getActiveConnectionCount;
    private getActiveRaceCount;
    private checkForAlerts;
}
//# sourceMappingURL=HealthMonitorService.d.ts.map