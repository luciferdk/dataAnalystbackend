"use strict";
// src/controller/controller.covid.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getCovidData;
const database_1 = __importDefault(require("../config/database"));
const redisCache_1 = require("../services/redisCache");
async function getCovidData(req, res) {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 25;
        const offset = (page - 1) * limit;
        const cacheKey = `covidData:${page}:${limit}`;
        // 1) Redis cache
        const cached = await (0, redisCache_1.getCache)(cacheKey);
        if (cached) {
            return res.status(200).json({ ...cached, cached: true });
        }
        // 2) Postgres query
        const totalResult = await database_1.default.query("SELECT COUNT(*)::bigint AS count FROM covid_data");
        const total = Number(totalResult.rows[0].count);
        const dataResult = await database_1.default.query(`
SELECT *
FROM covid_data
ORDER BY id
LIMIT $1 OFFSET $2
`, [limit, offset]);
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
        await (0, redisCache_1.setCache)(cacheKey, responsePayload, 300);
        return res.status(200).json({ ...responsePayload, cached: false });
    }
    catch (err) {
        console.error("Error in getCovidData:", err);
        return res.status(500).json({ error: "Failed to load data." });
    }
}
