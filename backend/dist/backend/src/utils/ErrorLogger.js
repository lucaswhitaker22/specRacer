"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorLogger = exports.AppError = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ErrorLogger {
    constructor() {
        this.logBuffer = [];
        this.maxBufferSize = 1000;
        this.logDirectory = path_1.default.join(process.cwd(), 'logs');
        this.flushInterval = null;
        this.initializeLogDirectory();
        this.startPeriodicFlush();
    }
    static getInstance() {
        if (!ErrorLogger.instance) {
            ErrorLogger.instance = new ErrorLogger();
        }
        return ErrorLogger.instance;
    }
    logError(error, context) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: error.message,
            code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
            stack: error.stack,
            context,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        };
        this.addLogEntry(entry);
        if (process.env.NODE_ENV === 'development') {
            console.error(`[${entry.timestamp}] ERROR ${entry.code}: ${entry.message}`);
            if (context) {
                console.error('Context:', context);
            }
            if (error.stack) {
                console.error(error.stack);
            }
        }
    }
    logWarning(message, code, context) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: 'warn',
            message,
            code,
            context
        };
        this.addLogEntry(entry);
        if (process.env.NODE_ENV === 'development') {
            console.warn(`[${entry.timestamp}] WARN ${entry.code}: ${entry.message}`);
        }
    }
    logInfo(message, code, context) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: 'info',
            message,
            code,
            context
        };
        this.addLogEntry(entry);
        if (process.env.NODE_ENV === 'development') {
            console.info(`[${entry.timestamp}] INFO ${entry.code}: ${entry.message}`);
        }
    }
    getRecentLogs(limit = 100) {
        return this.logBuffer.slice(-limit);
    }
    getErrorStats(timeWindow = 3600000) {
        const cutoff = Date.now() - timeWindow;
        const recentLogs = this.logBuffer.filter(entry => new Date(entry.timestamp).getTime() > cutoff);
        const errorsByCode = {};
        const errorsByLevel = {};
        recentLogs.forEach(entry => {
            errorsByCode[entry.code] = (errorsByCode[entry.code] || 0) + 1;
            errorsByLevel[entry.level] = (errorsByLevel[entry.level] || 0) + 1;
        });
        return {
            totalErrors: recentLogs.length,
            errorsByCode,
            errorsByLevel,
            recentErrors: recentLogs.slice(-10)
        };
    }
    async flushLogs() {
        if (this.logBuffer.length === 0)
            return;
        try {
            const logFile = path_1.default.join(this.logDirectory, `error-${new Date().toISOString().split('T')[0]}.log`);
            const logEntries = this.logBuffer.splice(0);
            const logContent = logEntries
                .map(entry => JSON.stringify(entry))
                .join('\n') + '\n';
            await promises_1.default.appendFile(logFile, logContent, 'utf8');
        }
        catch (error) {
            console.error('Failed to flush error logs:', error);
            this.logBuffer.unshift(...this.logBuffer.splice(0));
        }
    }
    async cleanupOldLogs(daysToKeep = 30) {
        try {
            const files = await promises_1.default.readdir(this.logDirectory);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            for (const file of files) {
                if (file.startsWith('error-') && file.endsWith('.log')) {
                    const filePath = path_1.default.join(this.logDirectory, file);
                    const stats = await promises_1.default.stat(filePath);
                    if (stats.mtime < cutoffDate) {
                        await promises_1.default.unlink(filePath);
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }
    async shutdown() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        await this.flushLogs();
    }
    addLogEntry(entry) {
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }
    }
    async initializeLogDirectory() {
        try {
            await promises_1.default.mkdir(this.logDirectory, { recursive: true });
        }
        catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }
    startPeriodicFlush() {
        this.flushInterval = setInterval(() => {
            this.flushLogs().catch(error => {
                console.error('Periodic log flush failed:', error);
            });
        }, 30000);
    }
}
exports.ErrorLogger = ErrorLogger;
//# sourceMappingURL=ErrorLogger.js.map