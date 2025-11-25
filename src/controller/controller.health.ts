
// src/controller/controller.health.ts

import { Request, Response } from "express";
import pool from "../config/database";
import { getCache, setCache } from "../services/redisCache";

export interface HealthDataRow {
  id: number;
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

export default async function getHealthData(req: Request, res: Response): Promise<Response> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const cacheKey = `healthData:${page}:${limit}`;

    // 1) Redis Cache
    const cached = await getCache<{
      page: number;
      limit: number;
      data: HealthDataRow[];
      hasMore: boolean;
      total: number;
    }>(cacheKey);

    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    // 2) Postgres query
    const totalResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::bigint AS count FROM health_data",
    );
    const total = Number(totalResult.rows[0].count);

    const dataResult = await pool.query<HealthDataRow>(
      `
      SELECT
        id,
        country,
        prevalence_rate,
        incidence_rate,
        mortality_rate,
        healthcare_access,
        disease_name,
        population_affected,
        doctors_per_1000,
        hospital_beds_per_1000
      FROM health_data
      ORDER BY id
      LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );

    const data = dataResult.rows;
    const hasMore = offset + data.length < total;

    const responsePayload = {
      page,
      limit,
      data,
      hasMore,
      total,
    };

    // 3) Set Redis cache
    await setCache(cacheKey, responsePayload, 300); // 5 min

    return res.status(200).json({ ...responsePayload, cached: false });
  } catch (err) {
    console.error("Error in getHealthData:", err);
    return res.status(500).json({ error: "Failed to load data." });
  }
}
