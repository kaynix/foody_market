import { ApiError, requestJson } from './request';

export interface SellerSession {
  id: string;
  status: 'active' | 'blocked';
  slug: string;
  storeName: string;
  onboardingCompleted: boolean;
}

export interface IdentityProviderSummary {
  name: 'development' | 'diia';
  displayName: string;
  available: boolean;
}

export async function fetchIdentityProviders(): Promise<IdentityProviderSummary[]> {
  const response = await requestJson<{ providers: IdentityProviderSummary[] }>('/api/auth/providers');
  return response.providers;
}

export async function fetchSellerSession(): Promise<SellerSession | null> {
  try {
    const response = await requestJson<{ seller: SellerSession }>('/api/auth/session');
    return response.seller;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function signInDevelopmentSeller(
  accountId: 'demo-seller' | 'new-seller',
): Promise<SellerSession> {
  const start = await requestJson<{ state: string }>('/api/auth/development/start', {
    method: 'POST',
    body: '{}',
  });
  const callback = await requestJson<{ seller: SellerSession }>(
    '/api/auth/development/callback',
    {
      method: 'POST',
      body: JSON.stringify({ state: start.state, accountId }),
    },
  );
  return callback.seller;
}

export async function signOutSeller(): Promise<void> {
  await requestJson<void>('/api/auth/logout', {
    method: 'POST',
    body: '{}',
    csrf: true,
  });
}
