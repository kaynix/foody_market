import { describe, expect, it } from 'vitest';
import { DevelopmentIdentityProvider } from './development';

describe('DevelopmentIdentityProvider', () => {
  it('returns only a normalized opaque identity for a known account', async () => {
    const provider = new DevelopmentIdentityProvider({ enabled: true, nodeEnv: 'test' });

    await expect(provider.complete({ accountId: 'demo-seller' })).resolves.toMatchObject({
      provider: 'development',
      subject: 'demo-seller',
    });
  });

  it('rejects unknown development accounts', async () => {
    const provider = new DevelopmentIdentityProvider({ enabled: true, nodeEnv: 'test' });

    await expect(provider.complete({ accountId: 'arbitrary-user' })).rejects.toMatchObject({
      code: 'INVALID_DEVELOPMENT_ACCOUNT',
    });
  });

  it('hard-stops in production even when accidentally enabled', async () => {
    const provider = new DevelopmentIdentityProvider({
      enabled: true,
      nodeEnv: 'production',
    });

    expect(provider.isAvailable()).toBe(false);
    await expect(provider.begin()).rejects.toMatchObject({
      code: 'IDENTITY_PROVIDER_UNAVAILABLE',
    });
  });
});
