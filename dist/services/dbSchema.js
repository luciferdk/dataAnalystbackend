"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSchema = ensureSchema;
// src/services/schema.ts
const database_1 = __importDefault(require("../config/database"));
async function ensureSchema() {
    // Drop existing tables if they exist (to avoid wrong column types)
    await database_1.default.query(`DROP TABLE IF EXISTS health_data;`);
    await database_1.default.query(`DROP TABLE IF EXISTS covid_data;`);
    // 1) health_data table - everything as TEXT
    await database_1.default.query(`
    CREATE TABLE IF NOT EXISTS health_data (
      id SERIAL PRIMARY KEY,
      country TEXT,
      prevalence_rate TEXT,
      incidence_rate TEXT,
      mortality_rate TEXT,
      healthcare_access TEXT,
      disease_name TEXT,
      population_affected TEXT,
      doctors_per_1000 TEXT,
      hospital_beds_per_1000 TEXT
    );
  `);
    // 2) covid_data table - everything as TEXT
    await database_1.default.query(`
    CREATE TABLE IF NOT EXISTS covid_data (
      id SERIAL PRIMARY KEY,
      "Country" TEXT,
      "Confirmed" TEXT,
      "Deaths" TEXT,
      "Recovered" TEXT,
      "Active" TEXT,
      "NewCases" TEXT,
      "NewDeaths" TEXT,
      "NewRecovered" TEXT
    );
  `);
    // 3) prediction_data table - everything as TEXT
    await database_1.default.query(`
  CREATE TABLE IF NOT EXISTS predicted_data (
  id SERIAL PRIMARY KEY,
  country TEXT,
  disease_name TEXT,
  year TEXT,
  predicted_prevalence_rate TEXT
);
`);
}
