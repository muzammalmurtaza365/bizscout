import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1).default('mongodb://localhost:27017/bizscout'),
  PING_TARGET_URL: z.string().url().default('https://httpbin.org/anything'),
  PING_INTERVAL_CRON: z.string().default('*/5 * * * *'),
  PING_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  ANOMALY_WINDOW_HOURS: z.coerce.number().positive().default(24),
  ANOMALY_Z_THRESHOLD: z.coerce.number().positive().default(3),
  ANOMALY_MIN_SAMPLES: z.coerce.number().int().positive().default(10),
  EWMA_ALPHA: z.coerce.number().min(0).max(1).default(0.3),
  // 0 disables the TTL; anything positive drops rows after N days.
  RESPONSE_TTL_DAYS: z.coerce.number().min(0).default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export type Env = typeof env;
