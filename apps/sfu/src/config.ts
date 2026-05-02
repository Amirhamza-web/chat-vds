import { z } from 'zod';
import os from 'node:os';

const Schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  MEDIASOUP_NUM_WORKERS: z.coerce.number().int().positive().default(os.cpus().length),
  MEDIASOUP_LISTEN_IP: z.string().default('0.0.0.0'),
  /**
   * Public IPv4 the clients connect to over UDP. MUST be set in production —
   * mediasoup advertises this in ICE candidates.
   */
  MEDIASOUP_ANNOUNCED_IP: z.string().optional(),
  MEDIASOUP_RTC_MIN_PORT: z.coerce.number().int().positive().default(40000),
  MEDIASOUP_RTC_MAX_PORT: z.coerce.number().int().positive().default(40100),
  MEDIASOUP_LOG_LEVEL: z.enum(['debug', 'warn', 'error', 'none']).default('warn'),
});

export type SfuEnv = z.infer<typeof Schema>;

let cached: SfuEnv | null = null;
export function loadEnv(): SfuEnv {
  if (cached) return cached;
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[sfu] invalid env:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}
