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
import authRoutes from './routes/auth';
import playerRoutes from './routes/players';
import carRoutes from './routes/cars';

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

// Health check endpoint with Redis status
app.get('/health', async (req, res) => {
  try {
    const redisHealth = await redisService.healthCheck();
    res.json({ 
      status: redisHealth.redis && redisHealth.services ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'text-racing-mmo-backend',
      redis: redisHealth
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'text-racing-mmo-backend',
      error: 'Health check failed'
    });
  }
});

// Redis system stats endpoint
app.get('/stats', async (req, res) => {
  try {
    const stats = await redisService.getSystemStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve system stats'
    });
  }
});

// Initialize services
async function initializeServices() {
  try {
    // Initialize database connection
    const dbConfig = getDatabaseConfigFromEnv();
    const db = createDatabaseConnection(dbConfig);
    await db.initialize();
    
    await redisService.initialize();
    CarService.initialize();
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

initializeServices();

// Initialize WebSocket server
const wsServer = new WebSocketServer(httpServer);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await wsServer.shutdown();
  await redisService.shutdown();
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await wsServer.shutdown();
  await redisService.shutdown();
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Text Racing MMO Backend running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

export { wsServer };