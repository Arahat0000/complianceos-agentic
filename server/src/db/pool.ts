import { Pool } from "pg";
import { config } from "../config.js";

// Same pool implementation for Supabase-hosted Postgres or a customer's own
// Postgres — only DATABASE_URL changes between tiers.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});
