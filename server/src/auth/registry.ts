import type { AppEnv } from '../config/env';
import { AuthError } from './errors';
import { DevelopmentIdentityProvider } from './providers/development';
import { DiiaIdentityProvider } from './providers/diia';
import type { IdentityProvider, IdentityProviderName } from './types';

export class IdentityProviderRegistry {
  private readonly providers = new Map<IdentityProviderName, IdentityProvider>();

  constructor(providers: IdentityProvider[]) {
    for (const provider of providers) {
      this.providers.set(provider.name, provider);
    }
  }

  list() {
    return [...this.providers.values()].map((provider) => ({
      name: provider.name,
      displayName: provider.displayName,
      available: provider.isAvailable(),
    }));
  }

  get(name: string): IdentityProvider {
    const provider = this.providers.get(name as IdentityProviderName);
    if (!provider || !provider.isAvailable()) {
      throw new AuthError(
        'Identity provider is unavailable',
        404,
        'IDENTITY_PROVIDER_UNAVAILABLE',
      );
    }
    return provider;
  }
}

export function createIdentityProviderRegistry(config: AppEnv): IdentityProviderRegistry {
  return new IdentityProviderRegistry([
    new DevelopmentIdentityProvider({
      enabled: config.DEV_IDENTITY_ENABLED,
      nodeEnv: config.NODE_ENV,
    }),
    new DiiaIdentityProvider(),
  ]);
}
