/** Typed JSON fetch helper for client components. */

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(body || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return (await r.json()) as T;
}

export const apiGet = <T>(path: string, init?: RequestInit): Promise<T> => api<T>(path, { ...init, method: 'GET' });

export function apiPost<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return api<T>(path, { ...init, method: 'POST', body: JSON.stringify(body) });
}
