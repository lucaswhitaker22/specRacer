import { PoolClient } from 'pg';
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
}
export declare class DatabaseConnection {
    private pool;
    private isConnected;
    constructor(config: DatabaseConfig);
    initialize(): Promise<void>;
    query(text: string, params?: any[]): Promise<any>;
    getClient(): Promise<PoolClient>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    isHealthy(): boolean;
    getPoolStats(): {
        totalCount: number;
        idleCount: number;
        waitingCount: number;
    };
    close(): Promise<void>;
}
export declare function createDatabaseConnection(config: DatabaseConfig): DatabaseConnection;
export declare function getDatabaseConnection(): DatabaseConnection;
export declare function getDatabaseConfigFromEnv(): DatabaseConfig;
//# sourceMappingURL=connection.d.ts.map