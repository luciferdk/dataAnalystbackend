// src/controller/controller.covid.ts

import { Request, Response } from "express";
import pool from "../config/database";
import { getCache, setCache } from "../services/redisCache";

interface CovidRow {
  id: number;
  Country: string;
  Confirmed: string;
  deaths: string;
  Recovered: string;
  Active: string;
  NewCases: string;
  NewDeaths: string;
  NewRecovered: string;
}

export default async function getCovidData(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const cacheKey = `covidData:${page}:${limit}`;

    // 1) Redis cache
    const cached = await getCache<{
      page: number;
      limit: number;
      data: CovidRow[];
      hasMore: boolean;
      total: number;
    }>(cacheKey);

    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    // 2) Postgres query
    const totalResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::bigint AS count FROM covid_data",
    );
    const total = Number(totalResult.rows[0].count);

    const dataResult = await pool.query<CovidRow>(
      `
SELECT *
FROM covid_data
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
    // 3) Cache in Redis
    await setCache(cacheKey, responsePayload, 300);

    return res.status(200).json({ ...responsePayload, cached: false });
  } catch (err) {
    console.error("Error in getCovidData:", err);
    return res.status(500).json({ error: "Failed to load data." });
  }
}
