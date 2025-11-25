// src/services/migrate.ts

import importHealthData from "./importHealthData";
import importCovidData from "./importCovidData";
import importPredictionData from "./importPredictionData";
import pool from "../config/database";
import { ensureSchema } from "./dbSchema";

async function runMigrations(): Promise<void> {
  console.log("🚀 Starting database migrations...\n");

  try {
    console.log("Ensuring Database Schema...");
    await ensureSchema();
    console.log("Schema is ready\n");

    //Import health data
    console.log("📊 Import health data...");
    await importHealthData();
    console.log("✅ Health Data imported\n");

    //Import COVID DATA
    console.log("🦠 Importing COVID data...");
    await importCovidData();
    console.log("✅ COVID data imported\n");

    console.log("📈 Importing predicted data...");
    await importPredictionData();
    console.log("✅ Predicted data imported\n");

    console.log("🎉 All migrations completed successfully!");
  } catch (err) {
    console.error("X Migration Failed:", err);
    throw err;
  } finally {
    await pool.end();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
