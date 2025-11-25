// services/importHealthData.ts

import fs from "fs";
import path from "path";
import csv from "csv-parser";
import pool from "../config/database";

interface HealthDataRow {
  country: string;
  prevalence_rate: string;
  incidence_rate: string;
  mortality_rate: string;
  healthcare_access: string;
  disease_name: string;
  population_affected: string;
  doctors_per_1000: string;
  hospital_beds_per_1000: string;
}

async function importHealthData(): Promise<void> {
  const filePath = path.join(
    process.cwd(),
    "src",
    "services",
    "motaData",
    "cleaned_global_health.csv",
  );

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }

  const client = await pool.connect();
  let count = 0;
  const batchSize = 1000;
  let batch: HealthDataRow[] = [];

  // helper to insert a batch using ONE bulk insert query
  const insertBatch = async (rows: HealthDataRow[]): Promise<void> => {
    if (!rows.length) return;

    const values: (string | number | null)[] = [];
    const valueClauses: string[] = [];

    rows.forEach((data, i) => {
      const baseIndex = i * 9;

      valueClauses.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9})`,
      );

      values.push(
        data.country ?? null,
        data.prevalence_rate ?? null,
        data.incidence_rate ?? null,
        data.mortality_rate ?? null,
        data.healthcare_access ?? null,
        data.disease_name ?? null,
        data.population_affected ?? null,
        data.doctors_per_1000 ?? null,
        data.hospital_beds_per_1000 ?? null,
      );
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

    await new Promise<void>((resolve, reject) => {
      const stream = fs
        .createReadStream(filePath)
        .pipe(
          csv({
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
          }),
        )
        .on("data", (row: HealthDataRow): void => {
          batch.push(row);

          if (batch.length >= batchSize) {
            stream.pause();
            const currentBatch = batch;
            batch = [];

            (async (): Promise<void> => {
              await insertBatch(currentBatch);
              stream.resume();
            })().catch((err) => reject(err));
          }
        })

        .on("end", (): void => {
          (async (): Promise<void> => {
            try {
              if (batch.length > 0) {
                await insertBatch(batch);
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          })();
        });
    });

    await client.query("COMMIT");
    console.log(`✅ Health data import completed! Total: ${count} records`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Import failed:", err);
    throw err;
  } finally {
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

export default importHealthData;
