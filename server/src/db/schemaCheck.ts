import { config } from "../config.js";
import { pool } from "./pool.js";

// Host/port/database only, never credentials: safe to print.
export function describeDatabase(): string {
  try {
    const u = new URL(config.databaseUrl);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

// True once the schema from sql/postgres/full_schema.sql is present.
export async function schemaReady(): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ ok: boolean }>(`SELECT to_regclass('"AgentSchedule"') IS NOT NULL AS ok`);
    return rows[0]?.ok === true;
  } catch {
    return false;
  }
}
