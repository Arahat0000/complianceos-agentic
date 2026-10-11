import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Always load the repo-root .env, not one relative to process.cwd() — npm
// workspace scripts run with cwd set to this package's own directory
// (worker/), so plain "dotenv/config" would look for worker/.env instead
// of the single .env.example-derived file at the repo root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../.env"), quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Same DATABASE_URL/ENCRYPTION_KEY as the API server — the worker reads and
// writes the same tables (Document, DiscoveryRun, Circular,
// DailyPipelineSnapshot, ...) and needs to decrypt the same encrypted
// columns (OrganizationAIConfig.aiApiKeyEncrypted / embeddingApiKeyEncrypted).
export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  encryptionKey: required("ENCRYPTION_KEY"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
};
