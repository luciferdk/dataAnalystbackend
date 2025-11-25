// src/config/database.ts

import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
	  rejectUnauthorized: false, // <- this allow self-signed cert
  },
  max: Number(process.env.PG_POOL_MAX || 50),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

export default pool;
