#!/usr/bin/env node
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
exports.seedCarData = seedCarData;
const dotenv = __importStar(require("dotenv"));
const CarService_1 = require("../services/CarService");
const connection_1 = require("./connection");
dotenv.config();
async function seedCarData() {
    console.log('Seeding car data...');
    try {
        CarService_1.CarService.initialize();
        const cars = CarService_1.CarService.getAvailableCars();
        let db;
        try {
            db = (0, connection_1.getDatabaseConnection)();
        }
        catch {
            const config = (0, connection_1.getDatabaseConfigFromEnv)();
            db = (0, connection_1.createDatabaseConnection)(config);
            await db.initialize();
        }
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
        await db.close();
        process.exit(0);
    }
    catch (error) {
        console.error('Car data seeding failed:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    seedCarData();
}
//# sourceMappingURL=seedCars.js.map