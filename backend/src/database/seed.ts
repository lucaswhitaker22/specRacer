#!/usr/bin/env node

/**
 * Database seeding script
 * This script populates the database with initial data
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createDatabaseConnection, getDatabaseConfigFromEnv, getDatabaseConnection } from './connection';

// Load environment variables
dotenv.config();

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    // Create database connection if it doesn't exist
    let db;
    try {
      db = getDatabaseConnection();
    } catch {
      const config = getDatabaseConfigFromEnv();
      db = createDatabaseConnection(config);
      await db.initialize();
    }
    
    // Read and execute seed data
    const seedPath = path.join(__dirname, 'seeds.sql');
    
    if (!fs.existsSync(seedPath)) {
      console.log('No seed file found, skipping seeding');
      return;
    }

    const seedSql = fs.readFileSync(seedPath, 'utf8');
    
    console.log('Executing seed data...');
    await db.query(seedSql);
    
    console.log('Database seeding completed successfully');
    
    // Close connection
    await db.close();
    
    process.exit(0);
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

export { seedDatabase };