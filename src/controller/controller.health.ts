// src/controller/controller.health.ts

import { Request, Response } from "express";
import fs from "fs";
import csv from "csv-parser";
import path from "path";

// CSV file path
const filePath = path.join(
  process.cwd(),
  "src",
  "controller",
  "data",
  "cleaned_global_health.csv"
);

// Define the structure of a CSV row
interface HealthDataRow {
  country: string;
  year: string;
  disease_name: string;
  disease_category: string;
  prevalence_rate_percent: string;
  incidence_rate_percent: string;
  mortality_rate_percent: string;
  age_group: string;
  gender: string;
  population_affected: string;
  healthcare_access_percent: string;
  doctors_per_1000: string;
  hospital_beds_per_1000: string;
  treatment_type: string;
  average_treatment_cost_usd: string;
  availability_of_vaccines_treatment: string;
  recovery_rate_percent: string;
  dalys: string;
  improvement_in_5_years_percent: string;
  per_capita_income_usd: string;
  education_index: string;
  urbanization_rate_percent: string;
  country_code: string;
}

export default function getHealthData(req: Request, res: Response) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found at: ${filePath}`);
    return res.status(500).json({ error: "CSV file not found" });
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const results: HealthDataRow[] = [];
  let rowIndex = 0;
  let sent = false;

  const stream = fs.createReadStream(filePath).pipe(csv());

  stream.on("data", (row: any) => {
    if (rowIndex >= startIndex && rowIndex < endIndex) {
      // Map CSV row keys to your typed keys if necessary
      results.push({
        country: row.country,
        year: row.year,
        disease_name: row.disease_name,
        disease_category: row.disease_category,
        prevalence_rate_percent: row["prevalence_rate_(%)"],
        incidence_rate_percent: row["incidence_rate_(%)"],
        mortality_rate_percent: row["mortality_rate_(%)"],
        age_group: row.age_group,
        gender: row.gender,
        population_affected: row.population_affected,
        healthcare_access_percent: row["healthcare_access_(%)"],
        doctors_per_1000: row.doctors_per_1000,
        hospital_beds_per_1000: row.hospital_beds_per_1000,
        treatment_type: row.treatment_type,
        average_treatment_cost_usd: row["average_treatment_cost_(usd)"],
        availability_of_vaccines_treatment: row["availability_of_vaccines/treatment"],
        recovery_rate_percent: row["recovery_rate_(%)"],
        dalys: row.dalys,
        improvement_in_5_years_percent: row["improvement_in_5_years_(%)"],
        per_capita_income_usd: row["per_capita_income_(usd)"],
        education_index: row.education_index,
        urbanization_rate_percent: row["urbanization_rate_(%)"],
        country_code: row.country_code,
      });
    }
    rowIndex++;

    if (rowIndex >= endIndex && !sent) {
      sent = true;
      stream.destroy();
      const hasMore = results.length === limit;
      res.status(200).json({ page, limit, data: results, hasMore });
    }
  });

  stream.on("end", () => {
    if (!sent) {
      sent = true;
      const hasMore = results.length === limit;
      res.status(200).json({ page, limit, data: results, hasMore });
    }
  });

  stream.on("error", (err) => {
    if (!sent) {
      sent = true;
      console.error("Error reading CSV file:", err);
      res.status(500).json({ error: "Failed to load data." });
    }
  });
}
