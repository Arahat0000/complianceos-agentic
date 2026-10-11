import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";
import type { StorageAdapter } from "./StorageAdapter.js";

// Enterprise tier — customer's own S3-compatible bucket (AWS S3 or
// self-hosted MinIO), configured via S3_* env vars.
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket = config.s3.bucket;

  constructor() {
    this.client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint || undefined,
      forcePathStyle: Boolean(config.s3.endpoint),
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }

  async upload({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType })
    );
    return { path: key };
  }

  async download(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`S3 object not found: ${key}`);
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }
}
