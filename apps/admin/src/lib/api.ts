import { createApiClient } from '@itti/api-client';
import { API_URL } from './env';

/** Typed client (Hono RPC): `api.v1.admin.courses.$get(...)` */
export const api = createApiClient(API_URL);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Per-field messages from a 422 response (e.g. { "fields.course_overview": "…" }). */
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/**
 * Untyped helper for generic resource screens.
 * Prefer the typed `api` client in feature screens.
 */
export async function http<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${API_URL}/v1${path}`, {
    credentials: 'include',
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
    throw new HttpError(res.status, body.error ?? res.statusText, body.fields);
  }
  return res.json() as Promise<T>;
}
