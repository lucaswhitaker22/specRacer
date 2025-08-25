"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisManager = exports.RedisManager = void 0;
const redis_1 = require("redis");
class RedisManager {
    constructor() {
        this.isConnected = false;
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = (0, redis_1.createClient)({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => {
                    if (process.env.NODE_ENV === 'development' && retries > 3) {
                        return false;
                    }
                    return Math.min(retries * 50, 30000);
                }
            }
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
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
    async connect() {
        try {
            const connectPromise = this.client.connect();
            if (process.env.NODE_ENV === 'development') {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
                });
                await Promise.race([connectPromise, timeoutPromise]);
            }
            else {
                await connectPromise;
            }
        }
        catch (error) {
            console.error('Failed to connect to Redis:', error);
            throw error;
        }
    }
    async disconnect() {
        try {
            await this.client.disconnect();
            this.isConnected = false;
        }
        catch (error) {
            console.error('Error disconnecting from Redis:', error);
        }
    }
    getClient() {
        return this.client;
    }
    isReady() {
        return this.isConnected;
    }
    async ping() {
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        }
        catch (error) {
            console.error('Redis ping failed:', error);
            return false;
        }
    }
}
exports.RedisManager = RedisManager;
exports.redisManager = new RedisManager();
//# sourceMappingURL=redis.js.map