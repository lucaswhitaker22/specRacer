import { getDatabaseConnection } from './connection';
import * as fs from 'fs';
import * as path from 'path';

export interface Migration {
  id: string;
  name: string;
  sql: string;
  timestamp: Date;
}

class MigrationManager {
  private get db() {
    return getDatabaseConnection();
  }

  /**
   * Initialize migrations table
   */
  async initializeMigrationsTable(): Promise<void> {
    const createMigrationsTableSql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await this.db.query(createMigrationsTableSql);
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations(): Promise<string[]> {
    try {
      const result = await this.db.query('SELECT id FROM migrations ORDER BY executed_at');
      return result.rows.map((row: any) => row.id);
    } catch (error) {
      // If migrations table doesn't exist, return empty array
      return [];
    }
  }

  /**
   * Mark migration as executed
   */
  async markMigrationExecuted(migrationId: string, name: string): Promise<void> {
    await this.db.query(
      'INSERT INTO migrations (id, name) VALUES ($1, $2)',
      [migrationId, name]
    );
  }

  /**
   * Load migration files from directory
   */
  loadMigrationFiles(migrationsDir: string): Migration[] {
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

  /**
   * Run pending migrations
   */
  async runPendingMigrations(migrationsDir?: string): Promise<void> {
    await this.initializeMigrationsTable();
    
    const executedMigrations = await this.getExecutedMigrations();
    
    // If no migrations directory specified, just run the base schema
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
    const pendingMigrations = migrations.filter(
      migration => !executedMigrations.includes(migration.id)
    );

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
          await client.query(
            'INSERT INTO migrations (id, name) VALUES ($1, $2)',
            [migration.id, migration.name]
          );
        });

        console.log(`Migration ${migration.name} completed successfully`);
      } catch (error) {
        console.error(`Migration ${migration.name} failed:`, error);
        throw error;
      }
    }

    console.log('All migrations completed successfully');
  }

  /**
   * Rollback last migration (if rollback file exists)
   */
  async rollbackLastMigration(migrationsDir: string): Promise<void> {
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
    } catch (error) {
      console.error(`Rollback failed for migration ${lastMigrationId}:`, error);
      throw error;
    }
  }
}

export const migrationManager = new MigrationManager();