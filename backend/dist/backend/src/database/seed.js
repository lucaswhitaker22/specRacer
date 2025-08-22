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
exports.seedDatabase = seedDatabase;
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const connection_1 = require("./connection");
dotenv.config();
async function seedDatabase() {
    console.log('Seeding database...');
    try {
        let db;
        try {
            db = (0, connection_1.getDatabaseConnection)();
        }
        catch {
            const config = (0, connection_1.getDatabaseConfigFromEnv)();
            db = (0, connection_1.createDatabaseConnection)(config);
            await db.initialize();
        }
        const seedPath = path.join(__dirname, 'seeds.sql');
        if (!fs.existsSync(seedPath)) {
            console.log('No seed file found, skipping seeding');
            return;
        }
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        console.log('Executing seed data...');
        await db.query(seedSql);
        console.log('Database seeding completed successfully');
        await db.close();
        process.exit(0);
    }
    catch (error) {
        console.error('Database seeding failed:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    seedDatabase();
}
//# sourceMappingURL=seed.js.map