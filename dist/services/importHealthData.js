"use strict";
// services/importHealthData.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const database_1 = __importDefault(require("../config/database"));
async function importHealthData() {
    const filePath = path_1.default.join(process.cwd(), "src", "services", "motaData", "cleaned_global_health.csv");
    if (!fs_1.default.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return;
    }
    const client = await database_1.default.connect();
    let count = 0;
    const batchSize = 1000;
    let batch = [];
    // helper to insert a batch using ONE bulk insert query
    const insertBatch = async (rows) => {
        if (!rows.length)
            return;
        const values = [];
        const valueClauses = [];
        rows.forEach((data, i) => {
            const baseIndex = i * 9;
            valueClauses.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9})`);
            values.push(data.country ?? null, data.prevalence_rate ?? null, data.incidence_rate ?? null, data.mortality_rate ?? null, data.healthcare_access ?? null, data.disease_name ?? null, data.population_affected ?? null, data.doctors_per_1000 ?? null, data.hospital_beds_per_1000 ?? null);
        });
        const query = `
      INSERT INTO health_data (
        country,
        prevalence_rate,
        incidence_rate,
        mortality_rate,
        healthcare_access,
        disease_name,
        population_affected,
        doctors_per_1000,
        hospital_beds_per_1000
      )
      VALUES ${valueClauses.join(", ")}
      ON CONFLICT DO NOTHING;
    `;
        await client.query(query, values);
        count += rows.length;
        console.log(`✅ Imported ${count} health records...`);
    };
    try {
        console.log("🚀 Starting health data import...");
        await client.query("BEGIN");
        await new Promise((resolve, reject) => {
            const stream = fs_1.default
                .createReadStream(filePath)
                .pipe((0, csv_parser_1.default)({
                mapHeaders: ({ header }) => {
                    const h = header.trim();
                    switch (h) {
                        case "country":
                            return "country";
                        case "prevalence_rate_(%)":
                            return "prevalence_rate";
                        case "incidence_rate_(%)":
                            return "incidence_rate";
                        case "mortality_rate_(%)":
                            return "mortality_rate";
                        case "healthcare_access_(%)":
                            return "healthcare_access";
                        case "disease_name":
                            return "disease_name";
                        case "population_affected":
                            return "population_affected";
                        case "doctors_per_1000":
                            return "doctors_per_1000";
                        case "hospital_beds_per_1000":
                            return "hospital_beds_per_1000";
                        default:
                            return null;
                    }
                },
            }))
                .on("data", (row) => {
                batch.push(row);
                if (batch.length >= batchSize) {
                    stream.pause();
                    const currentBatch = batch;
                    batch = [];
                    (async () => {
                        await insertBatch(currentBatch);
                        stream.resume();
                    })().catch((err) => reject(err));
                }
            })
                .on("end", () => {
                (async () => {
                    try {
                        if (batch.length > 0) {
                            await insertBatch(batch);
                        }
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                })();
            });
        });
        await client.query("COMMIT");
        console.log(`✅ Health data import completed! Total: ${count} records`);
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
if (require.main === module) {
    importHealthData()
        .then(() => {
        console.log("✅ Done");
        process.exit(0);
    })
        .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    });
}
exports.default = importHealthData;
