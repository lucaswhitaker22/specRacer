// Main entry point for the backend server
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { WebSocketServer } from './websocket/index';
import { CarService } from './services/CarService';
import { redisService } from './services/RedisService';
import { createDatabaseConnection, getDatabaseConfigFromEnv } from './database/connection';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler';
import { ErrorLogger } from './utils/ErrorLogger';
import { HealthMonitorService } from './services/HealthMonitorService';
import authRoutes from './routes/auth';
import playerRoutes from './routes/players';
import carRoutes from './routes/cars';
import raceRoutes from './routes/races';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/races', raceRoutes);

// Health check endpoint with comprehensive system health
app.get('/health', asyncHandler(async (req: express.Request, res: express.Response) => {
  const healthMonitor = HealthMonitorService.getInstance();
  const health = await healthMonitor.getCurrentHealth();
  
  const statusCode = health.overall === 'healthy' ? 200 : 
                    health.overall === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json({
    status: health.overall,
    timestamp: new Date().toISOString(),
    service: 'text-racing-mmo-backend',
    health
  });
}));

// System metrics endpoint
app.get('/metrics', asyncHandler(async (req: express.Request, res: express.Response) => {
  const healthMonitor = HealthMonitorService.getInstance();
  const metrics = await healthMonitor.getSystemMetrics();
  res.json(metrics);
}));

// Error logs endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/logs/errors', asyncHandler(async (req: express.Request, res: express.Response) => {
    const logger = ErrorLogger.getInstance();
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = logger.getRecentLogs(limit);
    res.json(logs);
  }));

  app.get('/logs/stats', asyncHandler(async (req: express.Request, res: express.Response) => {
    const logger = ErrorLogger.getInstance();
    const timeWindow = parseInt(req.query.timeWindow as string) || 3600000;
    const stats = logger.getErrorStats(timeWindow);
    res.json(stats);
  }));
}

// Initialize services
async function initializeServices() {
  const logger = ErrorLogger.getInstance();
  
  try {
    // Initialize database connection
    const dbConfig = getDatabaseConfigFromEnv();
    const db = createDatabaseConnection(dbConfig);
    await db.initialize();
    
    await redisService.initialize();
    CarService.initialize();
    
    // Start health monitoring
    const healthMonitor = HealthMonitorService.getInstance();
    healthMonitor.start();
    
    // Set up health monitor event listeners
    healthMonitor.on('alert', (alert) => {
      logger.logError(
        new Error(`Health alert: ${alert.message}`),
        { alertId: alert.id, component: alert.component, severity: alert.severity }
      );
    });

    // Set up periodic memory cleanup
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      if (memoryPercentage > 85) {
        logger.forceCleanup();
        healthMonitor.forceCleanup();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
    logger.logInfo('All services initialized successfully', 'SERVICES_INITIALIZED');
    console.log('All services initialized successfully');
  } catch (error) {
    logger.logError(error as Error, { operation: 'service_initialization' });
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Add error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize WebSocket server
const wsServer = new WebSocketServer(httpServer);

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  const logger = ErrorLogger.getInstance();
  const healthMonitor = HealthMonitorService.getInstance();
  
  console.log(`${signal} received, shutting down gracefully...`);
  logger.logInfo(`Graceful shutdown initiated by ${signal}`, 'SHUTDOWN_START');
  
  try {
    // Stop health monitoring
    healthMonitor.stop();
    
    // Shutdown WebSocket server
    await wsServer.shutdown();
    
    // Shutdown Redis
    await redisService.shutdown();
    
    // Flush logs
    await logger.shutdown();
    
    // Close HTTP server
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = ErrorLogger.getInstance();
  logger.logError(error, { operation: 'uncaught_exception' });
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const logger = ErrorLogger.getInstance();
  logger.logError(
    new Error(`Unhandled Rejection: ${reason}`),
    { operation: 'unhandled_rejection', promise: promise.toString() }
  );
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server after initializing services
async function startServer() {
  await initializeServices();
  
  httpServer.listen(PORT, () => {
    console.log(`Text Racing MMO Backend running on port ${PORT}`);
    console.log(`WebSocket server ready for connections`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { wsServer };