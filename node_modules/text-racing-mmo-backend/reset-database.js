#!/usr/bin/env node

/**
 * Database reset script for Text Racing MMO
 * This script drops all tables and recreates them
 */

const { Client } = require('pg');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'text_racing_mmo';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;

async function resetDatabase() {
  console.log('🔄 Resetting Text Racing MMO database...');
  
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Drop all tables in the correct order (respecting foreign key constraints)
    const dropQueries = [
      'DROP TABLE IF EXISTS race_participants CASCADE;',
      'DROP TABLE IF EXISTS races CASCADE;',
      'DROP TABLE IF EXISTS cars CASCADE;',
      'DROP TABLE IF EXISTS tracks CASCADE;',
      'DROP TABLE IF EXISTS players CASCADE;',
      'DROP TABLE IF EXISTS migrations CASCADE;',
      'DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;'
    ];

    for (const query of dropQueries) {
      await client.query(query);
    }

    console.log('✅ All tables dropped successfully');
    await client.end();

    console.log('🎯 Database reset completed. You can now run: npm run db:setup');

  } catch (error) {
    console.error('❌ Database reset failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };