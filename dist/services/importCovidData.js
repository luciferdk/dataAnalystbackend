"use strict";
// /services/importCovidData.ts
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const XLSX = __importStar(require("xlsx"));
const database_1 = __importDefault(require("../config/database"));
async function importCovidData() {
    const filePath = path_1.default.join(process.cwd(), "src", "services", "motaData", "country_wise_latest_covid.xlsx");
    if (!fs_1.default.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return;
    }
    const client = await database_1.default.connect();
    let count = 0;
    const batchSize = 1000;
    const insertBatch = async (rows) => {
        if (!rows.length)
            return;
        const values = [];
        const valueClauses = [];
        rows.forEach((row, i) => {
            const baseIndex = i * 8;
            valueClauses.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`);
            values.push(row.Country ?? null, row.Confirmed ?? null, row.Deaths ?? null, row.Recovered ?? null, row.Active ?? null, row["New cases"] ?? null, row["New deaths"] ?? null, row["New recovered"] ?? null);
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
        const rows = XLSX.utils.sheet_to_json(sheet, {
            defval: null,
        });
        let batch = [];
        for (const row of rows) {
            if (!row.Country)
                continue;
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
exports.default = importCovidData;
