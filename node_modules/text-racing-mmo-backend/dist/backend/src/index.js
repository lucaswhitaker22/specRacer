"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsServer = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const index_1 = require("./websocket/index");
const CarService_1 = require("./services/CarService");
const RedisService_1 = require("./services/RedisService");
const connection_1 = require("./database/connection");
const errorHandler_1 = require("./middleware/errorHandler");
const ErrorLogger_1 = require("./utils/ErrorLogger");
const HealthMonitorService_1 = require("./services/HealthMonitorService");
const auth_1 = __importDefault(require("./routes/auth"));
const players_1 = __importDefault(require("./routes/players"));
const cars_1 = __importDefault(require("./routes/cars"));
const races_1 = __importDefault(require("./routes/races"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));
app.use(express_1.default.json());
app.use('/api/auth', auth_1.default);
app.use('/api/players', players_1.default);
app.use('/api/cars', cars_1.default);
app.use('/api/races', races_1.default);
app.get('/health', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const healthMonitor = HealthMonitorService_1.HealthMonitorService.getInstance();
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
app.get('/metrics', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const healthMonitor = HealthMonitorService_1.HealthMonitorService.getInstance();
    const metrics = await healthMonitor.getSystemMetrics();
    res.json(metrics);
}));
if (process.env.NODE_ENV === 'development') {
    app.get('/logs/errors', (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const logger = ErrorLogger_1.ErrorLogger.getInstance();
        const limit = parseInt(req.query.limit) || 100;
        const logs = logger.getRecentLogs(limit);
        res.json(logs);
    }));
    app.get('/logs/stats', (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const logger = ErrorLogger_1.ErrorLogger.getInstance();
        const timeWindow = parseInt(req.query.timeWindow) || 3600000;
        const stats = logger.getErrorStats(timeWindow);
        res.json(stats);
    }));
}
async function initializeServices() {
    const logger = ErrorLogger_1.ErrorLogger.getInstance();
    try {
        const dbConfig = (0, connection_1.getDatabaseConfigFromEnv)();
        const db = (0, connection_1.createDatabaseConnection)(dbConfig);
        await db.initialize();
        await RedisService_1.redisService.initialize();
        CarService_1.CarService.initialize();
        const healthMonitor = HealthMonitorService_1.HealthMonitorService.getInstance();
        healthMonitor.start();
        healthMonitor.on('alert', (alert) => {
            logger.logError(new Error(`Health alert: ${alert.message}`), { alertId: alert.id, component: alert.component, severity: alert.severity });
        });
        setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
            if (memoryPercentage > 85) {
                logger.forceCleanup();
                healthMonitor.forceCleanup();
                if (global.gc) {
                    global.gc();
                }
            }
        }, 5 * 60 * 1000);
        logger.logInfo('All services initialized successfully', 'SERVICES_INITIALIZED');
        console.log('All services initialized successfully');
    }
    catch (error) {
        logger.logError(error, { operation: 'service_initialization' });
        console.error('Failed to initialize services:', error);
        process.exit(1);
    }
}
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
const wsServer = new index_1.WebSocketServer(httpServer);
exports.wsServer = wsServer;
async function gracefulShutdown(signal) {
    const logger = ErrorLogger_1.ErrorLogger.getInstance();
    const healthMonitor = HealthMonitorService_1.HealthMonitorService.getInstance();
    console.log(`${signal} received, shutting down gracefully...`);
    logger.logInfo(`Graceful shutdown initiated by ${signal}`, 'SHUTDOWN_START');
    try {
        healthMonitor.stop();
        await wsServer.shutdown();
        await RedisService_1.redisService.shutdown();
        await logger.shutdown();
        httpServer.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
        setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    }
    catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
    const logger = ErrorLogger_1.ErrorLogger.getInstance();
    logger.logError(error, { operation: 'uncaught_exception' });
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
    const logger = ErrorLogger_1.ErrorLogger.getInstance();
    logger.logError(new Error(`Unhandled Rejection: ${reason}`), { operation: 'unhandled_rejection', promise: promise.toString() });
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
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
//# sourceMappingURL=index.js.map