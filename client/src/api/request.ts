export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface ApiErrorBody {
  message?: string;
  code?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function readCookie(name: string): string | undefined {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit & { csrf?: boolean },
): Promise<T> {
  const csrfToken = init?.csrf ? readCookie('hutorynok_csrf') : undefined;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(body.message ?? `API error ${response.status}`, response.status, body.code);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
