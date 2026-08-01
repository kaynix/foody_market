import { z } from 'zod';
import { AuthError } from '../errors';
import type { IdentityProvider, IdentityStartResult, VerifiedIdentity } from '../types';

const completionSchema = z.object({
  accountId: z.enum(['demo-seller', 'new-seller']),
});

interface DevelopmentIdentityOptions {
  enabled: boolean;
  nodeEnv: 'development' | 'test' | 'production';
}

export class DevelopmentIdentityProvider implements IdentityProvider {
  readonly name = 'development' as const;
  readonly displayName = 'Локальний тестовий вхід';

  constructor(private readonly options: DevelopmentIdentityOptions) {}

  isAvailable(): boolean {
    return this.options.enabled && this.options.nodeEnv !== 'production';
  }

  async begin(): Promise<IdentityStartResult> {
    this.assertAvailable();
    return { mode: 'local' };
  }

  async complete(payload: unknown): Promise<VerifiedIdentity> {
    this.assertAvailable();
    const result = completionSchema.safeParse(payload);
    if (!result.success) {
      throw new AuthError('Unknown development account', 400, 'INVALID_DEVELOPMENT_ACCOUNT');
    }

    return {
      provider: this.name,
      subject: result.data.accountId,
      verifiedAt: new Date(),
    };
  }

  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new AuthError(
        'Development identity is disabled',
        404,
        'IDENTITY_PROVIDER_UNAVAILABLE',
      );
    }
  }
}
