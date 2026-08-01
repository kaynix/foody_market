import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const baseEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql:///hutorynok',
  TEST_DATABASE_URL: 'postgresql:///hutorynok_test',
  SESSION_SECRET: 'a'.repeat(32),
  PII_ENCRYPTION_KEY: '1'.repeat(64),
};

describe('parseEnv', () => {
  it('applies safe development defaults', () => {
    const config = parseEnv(baseEnv);

    expect(config.PORT).toBe(3001);
    expect(config.SESSION_TTL_HOURS).toBe(720);
    expect(config.IDENTITY_STATE_TTL_MINUTES).toBe(10);
    expect(config.CHANNEL_LINK_TTL_MINUTES).toBe(15);
    expect(config.OUTBOX_BATCH_SIZE).toBe(20);
    expect(config.STORAGE_DRIVER).toBe('local');
    expect(config.DEV_IDENTITY_ENABLED).toBe(false);
  });

  it('requires a separate database in test mode', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        NODE_ENV: 'test',
        TEST_DATABASE_URL: '',
      }),
    ).toThrow('TEST_DATABASE_URL');
  });

  it('requires an encryption key', () => {
    const { PII_ENCRYPTION_KEY: _omitted, ...withoutEncryptionKey } = baseEnv;

    expect(() => parseEnv(withoutEncryptionKey)).toThrow('PII_ENCRYPTION_KEY');
  });

  it('rejects unsafe production-only settings', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        DEV_IDENTITY_ENABLED: 'true',
        STORAGE_DRIVER: 'local',
        PII_ENCRYPTION_KEY: '0'.repeat(64),
      }),
    ).toThrow('Development identity must be disabled');
  });

  it('requires Telegram credentials as a pair', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        TELEGRAM_BOT_TOKEN: 'bot-token',
      }),
    ).toThrow('Telegram token and username must be configured together');
  });

  it('requires a Telegram webhook secret in production', () => {
    expect(() => parseEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      STORAGE_DRIVER: 's3',
      TELEGRAM_BOT_TOKEN: 'bot-token',
      TELEGRAM_BOT_USERNAME: 'hutorynok_bot',
    })).toThrow('Telegram webhook secret is required in production');
  });
});
