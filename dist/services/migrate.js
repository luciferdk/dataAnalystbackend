"use strict";
// src/services/migrate.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const importHealthData_1 = __importDefault(require("./importHealthData"));
const importCovidData_1 = __importDefault(require("./importCovidData"));
const importPredictionData_1 = __importDefault(require("./importPredictionData"));
const database_1 = __importDefault(require("../config/database"));
const dbSchema_1 = require("./dbSchema");
async function runMigrations() {
    console.log("🚀 Starting database migrations...\n");
    try {
        console.log("Ensuring Database Schema...");
        await (0, dbSchema_1.ensureSchema)();
        console.log("Schema is ready\n");
        //Import health data
        console.log("📊 Import health data...");
        await (0, importHealthData_1.default)();
        console.log("✅ Health Data imported\n");
        //Import COVID DATA
        console.log("🦠 Importing COVID data...");
        await (0, importCovidData_1.default)();
        console.log("✅ COVID data imported\n");
        console.log("📈 Importing predicted data...");
        await (0, importPredictionData_1.default)();
        console.log("✅ Predicted data imported\n");
        console.log("🎉 All migrations completed successfully!");
    }
    catch (err) {
        console.error("X Migration Failed:", err);
        throw err;
    }
    finally {
        await database_1.default.end();
    }
}
runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error(err);
    process.exit(1);
});
