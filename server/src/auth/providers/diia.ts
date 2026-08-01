import { AuthError } from '../errors';
import type { IdentityProvider, IdentityStartResult, VerifiedIdentity } from '../types';

export class DiiaIdentityProvider implements IdentityProvider {
  readonly name = 'diia' as const;
  readonly displayName = 'Дія';

  isAvailable(): boolean {
    return false;
  }

  async begin(): Promise<IdentityStartResult> {
    throw this.unavailable();
  }

  async complete(_payload: unknown): Promise<VerifiedIdentity> {
    throw this.unavailable();
  }

  private unavailable(): AuthError {
    return new AuthError(
      'Diia identity is not configured',
      404,
      'IDENTITY_PROVIDER_UNAVAILABLE',
    );
  }
}
