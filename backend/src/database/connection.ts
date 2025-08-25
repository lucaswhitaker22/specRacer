import { Pool, PoolClient, PoolConfig } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number; // maximum number of clients in the pool
  idleTimeoutMillis?: number; // how long a client is allowed to remain idle
  connectionTimeoutMillis?: number; // how long to wait when connecting a new client
}

export class DatabaseConnection {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor(config: DatabaseConfig) {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      max: config.max || 20, // maximum number of clients in the pool
      idleTimeoutMillis: config.idleTimeoutMillis || 30000, // 30 seconds
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000, // 2 seconds
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      this.isConnected = false;
    });

    // Handle pool connection events
    this.pool.on('connect', () => {
      console.log('Database client connected');
      this.isConnected = true;
    });

    this.pool.on('remove', () => {
      console.log('Database client removed');
    });
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      console.log('Database connection established successfully');
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to initialize database connection:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Execute a query with automatic connection handling
   */
  async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Executed query', { text, duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('Database query error:', { text, params, error });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<PoolClient> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return await this.pool.connect();
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }



  /**
   * Check if database is connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      console.log('Database connections closed');
    } catch (error) {
      console.error('Error closing database connections:', error);
      throw error;
    }
  }
}

// Create and export database instance
let dbInstance: DatabaseConnection | null = null;

export function createDatabaseConnection(config: DatabaseConfig): DatabaseConnection {
  if (dbInstance) {
    throw new Error('Database connection already exists');
  }
  
  dbInstance = new DatabaseConnection(config);
  return dbInstance;
}

export function getDatabaseConnection(): DatabaseConnection {
  if (!dbInstance) {
    throw new Error('Database connection not initialized. Call createDatabaseConnection first.');
  }
  return dbInstance;
}

// Configuration helper
export function getDatabaseConfigFromEnv(): DatabaseConfig {
  const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!, 10),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    ssl: process.env.NODE_ENV === 'production',
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 20,
    idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT ? parseInt(process.env.DB_IDLE_TIMEOUT, 10) : 30000,
    connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT ? parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) : 2000,
  };
}