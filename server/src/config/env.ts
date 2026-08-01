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
    PII_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    DEV_IDENTITY_ENABLED: booleanString,
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_UPLOAD_DIR: z.string().trim().min(1).default('./var/uploads'),
    TELEGRAM_BOT_TOKEN: optionalString,
    TELEGRAM_BOT_USERNAME: optionalString,
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

    const hasTelegramToken = Boolean(config.TELEGRAM_BOT_TOKEN);
    const hasTelegramUsername = Boolean(config.TELEGRAM_BOT_USERNAME);
    if (hasTelegramToken !== hasTelegramUsername) {
      context.addIssue({
        code: 'custom',
        path: ['TELEGRAM_BOT_TOKEN'],
        message: 'Telegram token and username must be configured together',
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
