#!/usr/bin/env node

/**
 * Car data seeding script
 * This script populates the database with licensed car models
 */

import * as dotenv from 'dotenv';
import { CarService } from '../services/CarService';
import { getDatabaseConnection } from './connection';

// Load environment variables
dotenv.config();

async function seedCarData() {
  console.log('Seeding car data...');
  
  try {
    // Initialize CarService to get seeded car data
    CarService.initialize();
    const cars = CarService.getAvailableCars();
    
    // Get database connection
    const db = getDatabaseConnection();
    
    console.log(`Inserting ${cars.length} car models...`);
    
    for (const car of cars) {
      const query = `
        INSERT INTO cars (id, name, manufacturer, year, specifications, licensing_info, is_active) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          manufacturer = EXCLUDED.manufacturer,
          year = EXCLUDED.year,
          specifications = EXCLUDED.specifications,
          licensing_info = EXCLUDED.licensing_info,
          is_active = EXCLUDED.is_active
      `;
      
      const values = [
        car.id,
        car.name,
        car.manufacturer,
        car.year,
        JSON.stringify(car.specifications),
        JSON.stringify(car.licensing),
        true
      ];
      
      await db.query(query, values);
      console.log(`✓ Inserted/Updated: ${car.manufacturer} ${car.name} (${car.year})`);
    }
    
    console.log('Car data seeding completed successfully');
    
    // Close connection
    await db.close();
    
    process.exit(0);
  } catch (error) {
    console.error('Car data seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedCarData();
}

export { seedCarData };