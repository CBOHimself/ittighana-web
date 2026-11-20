import { createIttiAuthClient } from '@itti/auth/client';
import { can, type Permission } from '@itti/schemas';
import { API_URL } from './env';

export const authClient = createIttiAuthClient(API_URL);

export function useSession() {
  return authClient.useSession();
}

/** Hide UI the current user can't use (the API still enforces it). */
export function usePermission(permission: Permission) {
  const { data } = useSession();
  return can((data?.user as { role?: string } | undefined)?.role, permission);
}
