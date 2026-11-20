/**
 * Roles & permissions. Shared by the API (enforcement) and the admin portal
 * (hiding menu items / buttons). The API is always the source of truth.
 */
export const ROLES = ['super_admin', 'admin', 'editor', 'admissions'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'content:read',
  'content:write',
  'content:publish',
  'forms:manage',
  'submissions:read',
  'submissions:manage',
  'bookings:manage',
  'inbox:read',
  'media:write',
  'users:manage',
  'settings:manage',
  'watermark:manage',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== 'watermark:manage' && p !== 'audit:read'),
  editor: ['content:read', 'content:write', 'media:write'],
  admissions: [
    'content:read',
    'forms:manage',
    'submissions:read',
    'submissions:manage',
    'bookings:manage',
    'inbox:read',
  ],
};

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role || !(ROLES as readonly string[]).includes(role)) return false;
  return ROLE_PERMISSIONS[role as Role].includes(permission);
}
