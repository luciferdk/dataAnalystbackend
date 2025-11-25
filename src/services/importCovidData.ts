// /services/importCovidData.ts


import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import pool from "../config/database";

interface CovidRowRaw {
  Country: string;
  Confirmed: number | string | null;
  Deaths: number | string | null;
  Recovered: number | string | null;
  Active: number | string | null;
  "New cases": number | string | null;
  "New deaths": number | string | null;
  "New recovered": number | string | null;
}

async function importCovidData(): Promise<void> {
  const filePath = path.join(
    process.cwd(),
    "src",
    "services",
    "motaData",
    "country_wise_latest_covid.xlsx"
  );

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }

  const client = await pool.connect();
  let count = 0;
  const batchSize = 1000;

  const insertBatch = async (rows: CovidRowRaw[]): Promise<void> => {
    if (!rows.length) return;

    const values: (string | number | null)[] = [];
    const valueClauses: string[] = [];

    rows.forEach((row, i) => {
      const baseIndex = i * 8;

      valueClauses.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`
      );

      values.push(
        row.Country ?? null,
        row.Confirmed ?? null,
        row.Deaths ?? null,
        row.Recovered ?? null,
        row.Active ?? null,
        row["New cases"] ?? null,
        row["New deaths"] ?? null,
        row["New recovered"] ?? null
      );
    });

    const query = `
      INSERT INTO covid_data (
        "Country",
        "Confirmed",
        "Deaths",
        "Recovered",
        "Active",
        "NewCases",
        "NewDeaths",
        "NewRecovered"
      )
      VALUES ${valueClauses.join(", ")}
      ON CONFLICT DO NOTHING;
    `;

    await client.query(query, values);
    count += rows.length;
    console.log(`✅ Imported ${count} COVID records...`);
  };

  try {
    console.log("🚀 Starting COVID data import...");

    await client.query("BEGIN");

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows: CovidRowRaw[] = XLSX.utils.sheet_to_json<CovidRowRaw>(sheet, {
      defval: null,
    });

    let batch: CovidRowRaw[] = [];

    for (const row of rows) {
      if (!row.Country) continue;

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
    console.log(`✅ COVID data import completed! Total: ${count} records`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Import failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  importCovidData()
    .then(() => {
      console.log("✅ Done");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Error:", err);
      process.exit(1);
    });
}

export default importCovidData;
