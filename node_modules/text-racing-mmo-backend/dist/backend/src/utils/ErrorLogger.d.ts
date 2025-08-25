export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly details?: any;
    readonly isOperational: boolean;
    constructor(message: string, statusCode?: number, code?: string, details?: any, isOperational?: boolean);
}
export interface ErrorContext {
    requestId?: string;
    method?: string;
    url?: string;
    userAgent?: string;
    ip?: string;
    playerId?: string;
    raceId?: string;
    [key: string]: any;
}
export interface ErrorLogEntry {
    timestamp: string;
    level: 'error' | 'warn' | 'info';
    message: string;
    code: string;
    stack?: string;
    context?: ErrorContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}
export declare class ErrorLogger {
    private static instance;
    private logBuffer;
    private readonly maxBufferSize;
    private readonly logDirectory;
    private flushInterval;
    private constructor();
    static getInstance(): ErrorLogger;
    logError(error: Error | AppError, context?: ErrorContext): void;
    logWarning(message: string, code: string, context?: ErrorContext): void;
    logInfo(message: string, code: string, context?: ErrorContext): void;
    getRecentLogs(limit?: number): ErrorLogEntry[];
    getErrorStats(timeWindow?: number): {
        totalErrors: number;
        errorsByCode: Record<string, number>;
        errorsByLevel: Record<string, number>;
        recentErrors: ErrorLogEntry[];
    };
    flushLogs(): Promise<void>;
    cleanupOldLogs(daysToKeep?: number): Promise<void>;
    forceCleanup(): void;
    shutdown(): Promise<void>;
    private addLogEntry;
    private initializeLogDirectory;
    private startPeriodicFlush;
}
//# sourceMappingURL=ErrorLogger.d.ts.map