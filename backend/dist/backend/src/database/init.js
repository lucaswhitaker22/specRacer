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
exports.initializeDatabase = initializeDatabase;
const dotenv = __importStar(require("dotenv"));
const connection_1 = require("./connection");
const migrations_1 = require("./migrations");
dotenv.config();
async function initializeDatabase() {
    console.log('Initializing database...');
    try {
        const config = (0, connection_1.getDatabaseConfigFromEnv)();
        const db = (0, connection_1.createDatabaseConnection)(config);
        await db.initialize();
        await migrations_1.migrationManager.runPendingMigrations();
        console.log('Database initialization completed successfully');
        await db.close();
        process.exit(0);
    }
    catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    initializeDatabase();
}
//# sourceMappingURL=init.js.map