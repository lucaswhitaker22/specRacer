import fs from 'fs/promises';
import path from 'path';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
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

/**
 * Centralized error logging and monitoring system
 */
export class ErrorLogger {
  private static instance: ErrorLogger;
  private logBuffer: ErrorLogEntry[] = [];
  private readonly maxBufferSize = 200; // Reduced from 1000
  private readonly logDirectory = path.join(process.cwd(), 'logs');
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeLogDirectory();
    this.startPeriodicFlush();
  }

  public static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Log an error with context
   */
  public logError(error: Error | AppError, context?: ErrorContext): void {
    const entry: ErrorLogEntry = {
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
    
    // Console output for development
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

  /**
   * Log a warning
   */
  public logWarning(message: string, code: string, context?: ErrorContext): void {
    const entry: ErrorLogEntry = {
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

  /**
   * Log an info message
   */
  public logInfo(message: string, code: string, context?: ErrorContext): void {
    const entry: ErrorLogEntry = {
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

  /**
   * Get recent error logs
   */
  public getRecentLogs(limit: number = 100): ErrorLogEntry[] {
    return this.logBuffer.slice(-limit);
  }

  /**
   * Get error statistics
   */
  public getErrorStats(timeWindow: number = 3600000): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    errorsByLevel: Record<string, number>;
    recentErrors: ErrorLogEntry[];
  } {
    const cutoff = Date.now() - timeWindow;
    const recentLogs = this.logBuffer.filter(
      entry => new Date(entry.timestamp).getTime() > cutoff
    );

    const errorsByCode: Record<string, number> = {};
    const errorsByLevel: Record<string, number> = {};

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

  /**
   * Flush logs to file
   */
  public async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    try {
      const logFile = path.join(
        this.logDirectory,
        `error-${new Date().toISOString().split('T')[0]}.log`
      );

      const logEntries = this.logBuffer.splice(0);
      const logContent = logEntries
        .map(entry => JSON.stringify(entry))
        .join('\n') + '\n';

      await fs.appendFile(logFile, logContent, 'utf8');
    } catch (error) {
      console.error('Failed to flush error logs:', error);
      // Put logs back in buffer if flush failed
      this.logBuffer.unshift(...this.logBuffer.splice(0));
    }
  }

  /**
   * Clean up old log files
   */
  public async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const files = await fs.readdir(this.logDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        if (file.startsWith('error-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDirectory, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Force memory cleanup
   */
  public forceCleanup(): void {
    // Flush current buffer to file immediately
    this.flushLogs().catch(error => {
      console.error('Failed to flush logs during cleanup:', error);
    });
    
    // Clear buffer more aggressively
    if (this.logBuffer.length > 50) {
      this.logBuffer = this.logBuffer.slice(-50);
    }
  }

  /**
   * Shutdown logger
   */
  public async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    await this.flushLogs();
  }

  private addLogEntry(entry: ErrorLogEntry): void {
    this.logBuffer.push(entry);
    
    // Prevent buffer overflow
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  private async initializeLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private startPeriodicFlush(): void {
    // Flush logs every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushLogs().catch(error => {
        console.error('Periodic log flush failed:', error);
      });
    }, 30000);
  }
}