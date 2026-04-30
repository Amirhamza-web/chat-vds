import fs from 'node:fs';
import path from 'node:path';
import { Client as MinioClient } from 'minio';
import { loadEnv } from '../config/env.js';
import { fileKey } from '../lib/id.js';

const env = loadEnv();

export interface StoredFile {
  key: string;
  url: string;
  size: number;
}

export interface Storage {
  put(stream: NodeJS.ReadableStream, filename: string, mimeType: string): Promise<StoredFile>;
}

class LocalStorage implements Storage {
  constructor(private uploadDir: string, private publicBase: string) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  async put(stream: NodeJS.ReadableStream, filename: string): Promise<StoredFile> {
    const ext = path.extname(filename);
    const safeExt = /^\.[a-zA-Z0-9]{1,8}$/.test(ext) ? ext : '';
    const key = `${fileKey()}${safeExt}`;
    const dest = path.join(this.uploadDir, key);
    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(dest);
      stream.pipe(out);
      out.on('finish', () => resolve());
      out.on('error', reject);
      stream.on('error', reject);
    });
    const stat = fs.statSync(dest);
    return {
      key,
      url: `${this.publicBase.replace(/\/$/, '')}/uploads/${key}`,
      size: stat.size,
    };
  }
}

class MinioStorage implements Storage {
  constructor(
    private client: MinioClient,
    private bucket: string,
    private publicBase: string,
  ) {}

  async put(
    stream: NodeJS.ReadableStream,
    filename: string,
    mimeType: string,
  ): Promise<StoredFile> {
    const ext = path.extname(filename);
    const safeExt = /^\.[a-zA-Z0-9]{1,8}$/.test(ext) ? ext : '';
    const key = `${fileKey()}${safeExt}`;
    await this.client.putObject(this.bucket, key, stream as never, undefined, {
      'Content-Type': mimeType,
    });
    const stat = await this.client.statObject(this.bucket, key);
    return {
      key,
      url: `${this.publicBase.replace(/\/$/, '')}/${this.bucket}/${key}`,
      size: stat.size,
    };
  }
}

let cached: Storage | null = null;

export function getStorage(): Storage {
  if (cached) return cached;
  if (env.STORAGE_DRIVER === 'minio') {
    if (!env.MINIO_ENDPOINT || !env.MINIO_ACCESS_KEY || !env.MINIO_SECRET_KEY) {
      throw new Error('STORAGE_DRIVER=minio but MINIO_* env vars are not set');
    }
    const client = new MinioClient({
      endPoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT ?? 9000,
      useSSL: env.MINIO_USE_SSL ?? false,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    });
    void ensureBucket(client, env.MINIO_BUCKET);
    cached = new MinioStorage(
      client,
      env.MINIO_BUCKET,
      env.MINIO_PUBLIC_URL ?? `${env.PUBLIC_BASE_URL}/storage`,
    );
  } else {
    cached = new LocalStorage(env.UPLOAD_DIR, env.PUBLIC_BASE_URL);
  }
  return cached;
}

async function ensureBucket(client: MinioClient, bucket: string) {
  const exists = await client.bucketExists(bucket).catch(() => false);
  if (!exists) await client.makeBucket(bucket).catch(() => undefined);
}
