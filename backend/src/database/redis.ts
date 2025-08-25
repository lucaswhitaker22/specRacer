import { createClient, RedisClientType } from 'redis';
import { RaceState, ParticipantState } from '../../../shared/types';

export class RedisManager {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          // In development, don't retry if Redis is not available
          if (process.env.NODE_ENV === 'development' && retries > 3) {
            return false; // Stop retrying
          }
          // Exponential backoff with max delay of 30 seconds
          return Math.min(retries * 50, 30000);
        }
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('Redis client connected');
    });

    this.client.on('ready', () => {
      console.log('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      console.log('Redis client disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      // Add timeout for Redis connection in development
      const connectPromise = this.client.connect();
      if (process.env.NODE_ENV === 'development') {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
        });
        await Promise.race([connectPromise, timeoutPromise]);
      } else {
        await connectPromise;
      }
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      this.isConnected = false;
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  isReady(): boolean {
    return this.isConnected;
  }

  // Health check method
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const redisManager = new RedisManager();