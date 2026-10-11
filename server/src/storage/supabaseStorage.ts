import { config } from "../config.js";
import type { StorageAdapter } from "./StorageAdapter.js";

// Free/Pro tier — talks to Supabase's Storage REST API directly (no SDK
// dependency needed for the operations we use).
export class SupabaseStorageAdapter implements StorageAdapter {
  private readonly baseUrl = `${config.supabase.url}/storage/v1`;
  private readonly bucket = config.supabase.storageBucket;

  private headers(extra: Record<string, string> = {}) {
    return {
      Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
      ...extra,
    };
  }

  async upload({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) {
    const res = await fetch(`${this.baseUrl}/object/${this.bucket}/${key}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": contentType }),
      body,
    });
    if (!res.ok) throw new Error(`Supabase upload failed: ${res.status} ${await res.text()}`);
    return { path: key };
  }

  async download(key: string): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/object/${this.bucket}/${key}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Supabase download failed: ${res.status} ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/object/${this.bucket}/${key}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Supabase delete failed: ${res.status} ${await res.text()}`);
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const res = await fetch(`${this.baseUrl}/object/sign/${this.bucket}/${key}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    if (!res.ok) throw new Error(`Supabase sign failed: ${res.status} ${await res.text()}`);
    const { signedURL } = (await res.json()) as { signedURL: string };
    return `${config.supabase.url}/storage/v1${signedURL}`;
  }
}
