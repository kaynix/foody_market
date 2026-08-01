import 'dotenv/config';
import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    FRONTEND_URL: z.url().default('http://localhost:5173'),
    PUBLIC_API_URL: z.url().default('http://localhost:3001'),
    DATABASE_URL: z.string().trim().min(1),
    TEST_DATABASE_URL: optionalString,
    SESSION_SECRET: z.string().min(32),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(8760).default(720),
    IDENTITY_STATE_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
    CHANNEL_LINK_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    PII_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    DEV_IDENTITY_ENABLED: booleanString,
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_UPLOAD_DIR: z.string().trim().min(1).default('./var/uploads'),
    S3_REGION: optionalString,
    S3_BUCKET: optionalString,
    S3_ENDPOINT: optionalString.pipe(z.url().optional()),
    S3_PUBLIC_URL: optionalString.pipe(z.url().optional()),
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    S3_FORCE_PATH_STYLE: booleanString,
    TELEGRAM_BOT_TOKEN: optionalString,
    TELEGRAM_BOT_USERNAME: optionalString,
    TELEGRAM_WEBHOOK_SECRET: optionalString,
    OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
    OUTBOX_LEASE_SECONDS: z.coerce.number().int().min(5).max(3600).default(60),
    OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(8),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).max(10_000).default(30),
    RATE_LIMIT_LINK_MAX: z.coerce.number().int().min(1).max(10_000).default(60),
    RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().min(1).max(10_000).default(60),
    RATE_LIMIT_CHECKOUT_MAX: z.coerce.number().int().min(1).max(10_000).default(30),
    RATE_LIMIT_TRACKING_MAX: z.coerce.number().int().min(1).max(10_000).default(120),
    RATE_LIMIT_ACTION_MAX: z.coerce.number().int().min(1).max(100_000).default(300),
    TRACKING_TTL_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
    CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    SESSION_RETENTION_DAYS: z.coerce.number().int().min(0).max(3650).default(7),
    LINK_INTENT_RETENTION_HOURS: z.coerce.number().int().min(0).max(8760).default(24),
    ACTION_TOKEN_RETENTION_DAYS: z.coerce.number().int().min(0).max(3650).default(7),
    WORKER_STALE_SECONDS: z.coerce.number().int().min(10).max(86400).default(120),
  })
  .superRefine((config, context) => {
    if (config.NODE_ENV === 'test' && !config.TEST_DATABASE_URL) {
      context.addIssue({
        code: 'custom',
        path: ['TEST_DATABASE_URL'],
        message: 'TEST_DATABASE_URL is required in test mode',
      });
    }

    if (config.NODE_ENV === 'production') {
      if (config.DEV_IDENTITY_ENABLED) {
        context.addIssue({
          code: 'custom',
          path: ['DEV_IDENTITY_ENABLED'],
          message: 'Development identity must be disabled in production',
        });
      }

      if (config.STORAGE_DRIVER === 'local') {
        context.addIssue({
          code: 'custom',
          path: ['STORAGE_DRIVER'],
          message: 'Local file storage is not allowed in production',
        });
      }

      if (config.PII_ENCRYPTION_KEY === '0'.repeat(64)) {
        context.addIssue({
          code: 'custom',
          path: ['PII_ENCRYPTION_KEY'],
          message: 'Development encryption key is not allowed in production',
        });
      }
    }

    if (config.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_REGION', 'S3_BUCKET', 'S3_PUBLIC_URL'] as const) {
        if (!config[key]) {
          context.addIssue({ code: 'custom', path: [key], message: `${key} is required for S3 storage` });
        }
      }
      if (Boolean(config.S3_ACCESS_KEY_ID) !== Boolean(config.S3_SECRET_ACCESS_KEY)) {
        context.addIssue({
          code: 'custom',
          path: ['S3_ACCESS_KEY_ID'],
          message: 'S3 access key and secret must be configured together',
        });
      }
    }

    const hasTelegramToken = Boolean(config.TELEGRAM_BOT_TOKEN);
    const hasTelegramUsername = Boolean(config.TELEGRAM_BOT_USERNAME);
    if (hasTelegramToken !== hasTelegramUsername) {
      context.addIssue({
        code: 'custom',
        path: ['TELEGRAM_BOT_TOKEN'],
        message: 'Telegram token and username must be configured together',
      });
    }
    if (config.NODE_ENV === 'production' && hasTelegramToken && !config.TELEGRAM_WEBHOOK_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['TELEGRAM_WEBHOOK_SECRET'],
        message: 'Telegram webhook secret is required in production',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: NodeJS.ProcessEnv): AppEnv {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
