import { createAuthClient } from 'better-auth/react';
import { adminClient, twoFactorClient } from 'better-auth/client/plugins';

/** Browser auth client for the admin portal. */
export function createIttiAuthClient(apiUrl: string) {
  return createAuthClient({
    baseURL: apiUrl,
    basePath: '/v1/auth',
    fetchOptions: { credentials: 'include' },
    plugins: [adminClient(), twoFactorClient()],
  });
}
export type IttiAuthClient = ReturnType<typeof createIttiAuthClient>;
