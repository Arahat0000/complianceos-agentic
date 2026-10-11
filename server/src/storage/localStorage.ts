import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { StorageAdapter } from "./StorageAdapter.js";

// Filesystem storage for local development and demos (STORAGE_MODE=local).
// Signed URLs point at this API's public /storage/* route (routes/storage.ts).
const root = () => path.resolve(config.localStorageDir);

// Keys are always joined under `root` — reject anything that would escape it.
function resolveKey(key: string): string {
  const full = path.resolve(root(), key);
  if (full !== root() && !full.startsWith(root() + path.sep)) throw new Error("Invalid storage key");
  return full;
}

function signKey(key: string, exp: number): string {
  return createHmac("sha256", config.jwtSecret).update(`${key}:${exp}`).digest("hex");
}

export function verifySignature(key: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signKey(key, exp), "hex");
  const given = Buffer.from(sig, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export class LocalStorageAdapter implements StorageAdapter {
  async upload({ key, body }: { key: string; body: Buffer; contentType: string }): Promise<{ path: string }> {
    const file = resolveKey(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { path: key };
  }

  async download(key: string): Promise<Buffer> {
    return readFile(resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    await rm(resolveKey(key), { force: true });
  }

  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const q = new URLSearchParams({ exp: String(exp), sig: signKey(key, exp) });
    return `${config.publicApiUrl}/storage/${key.split("/").map(encodeURIComponent).join("/")}?${q}`;
  }
}
