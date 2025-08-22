#!/usr/bin/env node

/**
 * Database initialization script
 * This script sets up the database schema and runs initial migrations
 */

import * as dotenv from 'dotenv';
import { createDatabaseConnection, getDatabaseConfigFromEnv } from './connection';
import { migrationManager } from './migrations';

// Load environment variables
dotenv.config();

async function initializeDatabase() {
  console.log('Initializing database...');
  
  try {
    // Create database connection
    const config = getDatabaseConfigFromEnv();
    const db = createDatabaseConnection(config);
    
    // Initialize connection
    await db.initialize();
    
    // Run migrations
    await migrationManager.runPendingMigrations();
    
    console.log('Database initialization completed successfully');
    
    // Close connection
    await db.close();
    
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

export { initializeDatabase };