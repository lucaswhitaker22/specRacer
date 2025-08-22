"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrationManager = void 0;
const connection_1 = require("./connection");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class MigrationManager {
    constructor() {
        this.db = (0, connection_1.getDatabaseConnection)();
    }
    async initializeMigrationsTable() {
        const createMigrationsTableSql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
        await this.db.query(createMigrationsTableSql);
    }
    async getExecutedMigrations() {
        try {
            const result = await this.db.query('SELECT id FROM migrations ORDER BY executed_at');
            return result.rows.map((row) => row.id);
        }
        catch (error) {
            return [];
        }
    }
    async markMigrationExecuted(migrationId, name) {
        await this.db.query('INSERT INTO migrations (id, name) VALUES ($1, $2)', [migrationId, name]);
    }
    loadMigrationFiles(migrationsDir) {
        if (!fs.existsSync(migrationsDir)) {
            return [];
        }
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        return files.map(file => {
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');
            const id = path.basename(file, '.sql');
            return {
                id,
                name: file,
                sql,
                timestamp: fs.statSync(filePath).mtime
            };
        });
    }
    async runPendingMigrations(migrationsDir) {
        await this.initializeMigrationsTable();
        const executedMigrations = await this.getExecutedMigrations();
        if (!migrationsDir) {
            const schemaPath = path.join(__dirname, 'schema.sql');
            if (fs.existsSync(schemaPath) && !executedMigrations.includes('001_initial_schema')) {
                console.log('Running initial schema migration...');
                const schemaSql = fs.readFileSync(schemaPath, 'utf8');
                await this.db.query(schemaSql);
                await this.markMigrationExecuted('001_initial_schema', 'Initial schema');
                console.log('Initial schema migration completed');
            }
            return;
        }
        const migrations = this.loadMigrationFiles(migrationsDir);
        const pendingMigrations = migrations.filter(migration => !executedMigrations.includes(migration.id));
        if (pendingMigrations.length === 0) {
            console.log('No pending migrations');
            return;
        }
        console.log(`Running ${pendingMigrations.length} pending migrations...`);
        for (const migration of pendingMigrations) {
            try {
                console.log(`Executing migration: ${migration.name}`);
                await this.db.transaction(async (client) => {
                    await client.query(migration.sql);
                    await client.query('INSERT INTO migrations (id, name) VALUES ($1, $2)', [migration.id, migration.name]);
                });
                console.log(`Migration ${migration.name} completed successfully`);
            }
            catch (error) {
                console.error(`Migration ${migration.name} failed:`, error);
                throw error;
            }
        }
        console.log('All migrations completed successfully');
    }
    async rollbackLastMigration(migrationsDir) {
        const executedMigrations = await this.getExecutedMigrations();
        if (executedMigrations.length === 0) {
            console.log('No migrations to rollback');
            return;
        }
        const lastMigrationId = executedMigrations[executedMigrations.length - 1];
        const rollbackFile = path.join(migrationsDir, `${lastMigrationId}.rollback.sql`);
        if (!fs.existsSync(rollbackFile)) {
            throw new Error(`Rollback file not found for migration: ${lastMigrationId}`);
        }
        const rollbackSql = fs.readFileSync(rollbackFile, 'utf8');
        try {
            await this.db.transaction(async (client) => {
                await client.query(rollbackSql);
                await client.query('DELETE FROM migrations WHERE id = $1', [lastMigrationId]);
            });
            console.log(`Migration ${lastMigrationId} rolled back successfully`);
        }
        catch (error) {
            console.error(`Rollback failed for migration ${lastMigrationId}:`, error);
            throw error;
        }
    }
}
exports.migrationManager = new MigrationManager();
//# sourceMappingURL=migrations.js.map