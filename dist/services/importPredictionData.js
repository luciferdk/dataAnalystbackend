"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/services/importPredictionData.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../config/database"));
async function importPredictionData() {
    await database_1.default.query(`DROP TABLE IF EXISTS prediccted_data`);
    await database_1.default.query(`
  CREATE TABLE IF NOT EXISTS predicted_data (
  id SERIAL PRIMARY KEY,
  country TEXT,
  disease_name TEXT,
  year TEXT,
  predicted_prevalence_rate TEXT
);
`);
    const filePath = path_1.default.join(process.cwd(), "src", "services", "motaData", "predicted_global_health.json");
    if (!fs_1.default.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return;
    }
    const client = await database_1.default.connect();
    let count = 0;
    const batchSize = 1000;
    // Helper to insert a batch using ONE bulk INSERT
    const insertBatch = async (rows) => {
        if (!rows.length)
            return;
        const values = [];
        const valueClauses = [];
        rows.forEach((row, i) => {
            const baseIndex = i * 4;
            valueClauses.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`);
            const country = row.Country ?? null;
            const diseaseName = row["Disease Name"] ?? null;
            const year = row.Year === undefined || row.Year === null ? null : String(row.Year);
            const predicted = row["Predicted Prevalence Rate (%)"] === undefined ||
                row["Predicted Prevalence Rate (%)"] === null
                ? null
                : String(row["Predicted Prevalence Rate (%)"]);
            values.push(country, diseaseName, year, predicted);
        });
        const query = `
      INSERT INTO predicted_data (
        country,
        disease_name,
        year,
        predicted_prevalence_rate
      )
      VALUES ${valueClauses.join(", ")};
    `;
        await client.query(query, values);
        count += rows.length;
        console.log(`✅ Imported ${count} predicted records...`);
    };
    try {
        console.log("🚀 Starting predicted data import...");
        const raw = fs_1.default.readFileSync(filePath, "utf8");
        const allRows = JSON.parse(raw);
        await client.query("BEGIN");
        let batch = [];
        for (const row of allRows) {
            // basic sanity: require Country + Disease Name + Year
            if (!row.Country || !row["Disease Name"] || row.Year === undefined) {
                continue;
            }
            batch.push(row);
            if (batch.length >= batchSize) {
                await insertBatch(batch);
                batch = [];
            }
        }
        if (batch.length > 0) {
            await insertBatch(batch);
        }
        await client.query("COMMIT");
        console.log(`🎉 Predicted data import completed! Total: ${count} records`);
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Import failed:", err);
        throw err;
    }
    finally {
        client.release();
    }
}
// Run if called directly (when compiled to CommonJS)
if (require.main === module) {
    importPredictionData()
        .then(() => {
        console.log("✅ Done");
        process.exit(0);
    })
        .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    });
}
exports.default = importPredictionData;
