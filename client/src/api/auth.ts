const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

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

interface ApiErrorBody {
  message?: string;
  code?: string;
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const error = new Error(body.message ?? `API error ${response.status}`);
    Object.assign(error, { status: response.status, code: body.code });
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchIdentityProviders(): Promise<IdentityProviderSummary[]> {
  const response = await authFetch<{ providers: IdentityProviderSummary[] }>('/api/auth/providers');
  return response.providers;
}

export async function fetchSellerSession(): Promise<SellerSession | null> {
  try {
    const response = await authFetch<{ seller: SellerSession }>('/api/auth/session');
    return response.seller;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function signInDevelopmentSeller(
  accountId: 'demo-seller' | 'new-seller',
): Promise<SellerSession> {
  const start = await authFetch<{ state: string }>('/api/auth/development/start', {
    method: 'POST',
    body: '{}',
  });
  const callback = await authFetch<{ seller: SellerSession }>(
    '/api/auth/development/callback',
    {
      method: 'POST',
      body: JSON.stringify({ state: start.state, accountId }),
    },
  );
  return callback.seller;
}

function readCookie(name: string): string | undefined {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

export async function signOutSeller(): Promise<void> {
  const csrfToken = readCookie('hutorynok_csrf');
  await authFetch<void>('/api/auth/logout', {
    method: 'POST',
    body: '{}',
    headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
  });
}
