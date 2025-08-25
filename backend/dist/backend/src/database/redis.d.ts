import { RedisClientType } from 'redis';
export declare class RedisManager {
    private client;
    private isConnected;
    constructor();
    private setupEventHandlers;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getClient(): RedisClientType;
    isReady(): boolean;
    ping(): Promise<boolean>;
}
export declare const redisManager: RedisManager;
//# sourceMappingURL=redis.d.ts.map