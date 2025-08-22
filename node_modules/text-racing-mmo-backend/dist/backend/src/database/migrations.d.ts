export interface Migration {
    id: string;
    name: string;
    sql: string;
    timestamp: Date;
}
declare class MigrationManager {
    private db;
    initializeMigrationsTable(): Promise<void>;
    getExecutedMigrations(): Promise<string[]>;
    markMigrationExecuted(migrationId: string, name: string): Promise<void>;
    loadMigrationFiles(migrationsDir: string): Migration[];
    runPendingMigrations(migrationsDir?: string): Promise<void>;
    rollbackLastMigration(migrationsDir: string): Promise<void>;
}
export declare const migrationManager: MigrationManager;
export {};
//# sourceMappingURL=migrations.d.ts.map