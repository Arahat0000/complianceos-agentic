import { Pool } from "pg";
import { config } from "../config.js";

// Same connection pattern as server/src/db/pool.ts — works against
// Supabase-hosted Postgres or a customer's own Postgres, only DATABASE_URL
// changes. Kept as its own instance since the worker runs in a separate
// process from the API server.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});
