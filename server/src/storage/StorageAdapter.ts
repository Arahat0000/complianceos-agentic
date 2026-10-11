export interface StorageAdapter {
  upload(params: { key: string; body: Buffer; contentType: string }): Promise<{ path: string }>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
