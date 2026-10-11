import { config } from "../config.js";
import { LocalStorageAdapter } from "./localStorage.js";
import { S3StorageAdapter } from "./s3Storage.js";
import { SupabaseStorageAdapter } from "./supabaseStorage.js";
import type { StorageAdapter } from "./StorageAdapter.js";

export type { StorageAdapter };

function createStorage(): StorageAdapter {
  if (config.storageMode === "s3") return new S3StorageAdapter();
  if (config.storageMode === "local") return new LocalStorageAdapter();
  return new SupabaseStorageAdapter();
}

export const storage: StorageAdapter = createStorage();
