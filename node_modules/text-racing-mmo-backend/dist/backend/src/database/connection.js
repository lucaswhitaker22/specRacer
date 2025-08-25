"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConnection = void 0;
exports.createDatabaseConnection = createDatabaseConnection;
exports.getDatabaseConnection = getDatabaseConnection;
exports.getDatabaseConfigFromEnv = getDatabaseConfigFromEnv;
const pg_1 = require("pg");
class DatabaseConnection {
    constructor(config) {
        this.isConnected = false;
        const poolConfig = {
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            ssl: config.ssl,
            max: config.max || 20,
            idleTimeoutMillis: config.idleTimeoutMillis || 30000,
            connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
        };
        this.pool = new pg_1.Pool(poolConfig);
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            this.isConnected = false;
        });
        this.pool.on('connect', () => {
            console.log('Database client connected');
            this.isConnected = true;
        });
        this.pool.on('remove', () => {
            console.log('Database client removed');
        });
    }
    async initialize() {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            console.log('Database connection established successfully');
            this.isConnected = true;
        }
        catch (error) {
            console.error('Failed to initialize database connection:', error);
            this.isConnected = false;
            throw error;
        }
    }
    async query(text, params) {
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
        }
        catch (error) {
            console.error('Database query error:', { text, params, error });
            throw error;
        }
    }
    async getClient() {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }
        return await this.pool.connect();
    }
    async transaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    isHealthy() {
        return this.isConnected;
    }
    getPoolStats() {
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
        };
    }
    async close() {
        try {
            await this.pool.end();
            this.isConnected = false;
            console.log('Database connections closed');
        }
        catch (error) {
            console.error('Error closing database connections:', error);
            throw error;
        }
    }
}
exports.DatabaseConnection = DatabaseConnection;
let dbInstance = null;
function createDatabaseConnection(config) {
    if (dbInstance) {
        throw new Error('Database connection already exists');
    }
    dbInstance = new DatabaseConnection(config);
    return dbInstance;
}
function getDatabaseConnection() {
    if (!dbInstance) {
        throw new Error('Database connection not initialized. Call createDatabaseConnection first.');
    }
    return dbInstance;
}
function getDatabaseConfigFromEnv() {
    const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }
    return {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.NODE_ENV === 'production',
        max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 20,
        idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT ? parseInt(process.env.DB_IDLE_TIMEOUT, 10) : 30000,
        connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT ? parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) : 2000,
    };
}
//# sourceMappingURL=connection.js.map