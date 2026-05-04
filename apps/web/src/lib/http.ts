import { useAuthStore } from './store';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const API_BASE = `${API_URL}/api/v1`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public payload: unknown,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return false;
  refreshing = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clear();
        return false;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      clear();
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  formData?: FormData;
  skipAuth?: boolean;
}

export async function api<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const doFetch = async (): Promise<Response> => {
    const { accessToken } = useAuthStore.getState();
    if (!opts.skipAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url.toString(), { method: opts.method ?? 'GET', headers, body });
  };

  let res = await doFetch();
  if (res.status === 401 && !opts.skipAuth) {
    const ok = await tryRefresh();
    if (ok) res = await doFetch();
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : null) ?? `Request failed: ${res.status}`;
    throw new ApiError(res.status, data, message);
  }
  return data as T;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export const apiBaseUrl = API_URL;
