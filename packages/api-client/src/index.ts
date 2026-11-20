import type { AppType } from '@itti/api';
import { hc } from 'hono/client';

/**
 * Fully typed API client (Hono RPC). Request and response types come straight
 * from the API routes, so the admin and web apps break at compile time if the API changes.
 *
 *   const api = createApiClient(import.meta.env.VITE_API_URL);
 *   const res = await api.v1.admin.courses.$get({ query: { page: '1' } });
 */
export function createApiClient(baseUrl: string, init?: RequestInit) {
  return hc<AppType>(baseUrl, {
    init: { credentials: 'include', ...init },
  });
}
export type ApiClient = ReturnType<typeof createApiClient>;
