import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Always load the repo-root .env, not one relative to process.cwd() — npm
// workspace scripts run with cwd set to this package's own directory
// (server/), so plain "dotenv/config" would look for server/.env instead
// of the single .env.example-derived file at the repo root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../.env"), quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",

  databaseUrl: required("DATABASE_URL"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  // 32-byte key, hex-encoded (64 hex chars) — generate with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  encryptionKey: required("ENCRYPTION_KEY"),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "",
    // redirect_uri used when exchanging an authorization code (must match the
    // one the frontend used). Falls back to the callback URL.
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? process.env.GOOGLE_CALLBACK_URL ?? "",
  },

  // Optional outbound mail. Without SMTP_HOST, OTP emails are logged to the
  // console instead (development only). SMTP over implicit TLS (port 465) or
  // plain/no-TLS relay (port 25/587 without STARTTLS is NOT supported).
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 465),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "ComplianceOS <no-reply@complianceos.local>",
  },

  // "supabase" for free/pro tenants, "s3" for enterprise self-hosted
  storageMode: (process.env.STORAGE_MODE ?? "supabase") as "supabase" | "s3" | "local",
  // "local" mode: files live on disk and are served through signed /storage/* URLs.
  localStorageDir: process.env.STORAGE_LOCAL_DIR ?? "./storage",
  publicApiUrl: process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  supabase: {
    url: process.env.SUPABASE_URL ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "complianceos",
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "",
    bucket: process.env.S3_BUCKET ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    region: process.env.S3_REGION ?? "us-east-1",
  },

  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
};
