import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Storage: 'local' or 'minio'
  STORAGE_DRIVER: z.enum(['local', 'minio']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  PUBLIC_BASE_URL: z.string().default('http://localhost:3001'),

  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().int().optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().default('chat-vds'),
  MINIO_USE_SSL: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  MINIO_PUBLIC_URL: z.string().optional(),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),

  // Web Push (VAPID). All three must be set to enable push notifications.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(), // e.g. mailto:admin@example.com
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;
export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:');
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}
