import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { APIError } from 'better-auth/api';
import { admin, twoFactor } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';
import type { Db } from 'mongodb';

const ac = createAccessControl(defaultStatements);
const staffRole = ac.newRole({ user: [], session: [] });
const adminRole = ac.newRole({
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'impersonate',
    'impersonate-admins',
    'delete',
    'set-password',
    'set-email',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
});

export type AuthOptions = {
  db: Db;
  secret: string;
  /** Public URL of the API, e.g. https://api.ittighana.com */
  baseURL: string;
  /** Origins allowed to call auth endpoints (web + admin). */
  trustedOrigins: string[];
  /** e.g. ".ittighana.com" in production so admin. and api. share the session. */
  cookieDomain?: string;
  /** Roles allowed to sign in to the staff portal (default: super_admin, admin). */
  portalRoles?: readonly string[];
  sendResetPassword: (args: { email: string; url: string }) => Promise<void>;
};

/** Roles allowed into the staff portal unless overridden (PORTAL_ROLES). */
export const DEFAULT_PORTAL_ROLES = ['super_admin', 'admin'] as const;

/** Session lifetime: signed out after 8 hours idle, refreshed hourly while in use. */
export const SESSION_MAX_AGE = 60 * 60 * 8;

/**
 * Better Auth on MongoDB for the staff portal (ittighana.com/staff).
 * - No public sign-up: accounts are created by an admin (approved credentials only).
 * - Only portal roles (default super_admin, admin) can start a session; banned users can't.
 * - Email + password only (no magic links). 2FA is installed but not enforced for now.
 * - Strict rate limits on sign-in and password reset; lockout is handled by the API
 *   (apps/api/src/lib/login-guard.ts) because it needs per-account counters.
 */
export function createAuth(opts: AuthOptions) {
  const portalRoles = new Set<string>(opts.portalRoles?.length ? opts.portalRoles : DEFAULT_PORTAL_ROLES);
  return betterAuth({
    appName: 'ITTI Ghana Admin',
    secret: opts.secret,
    baseURL: opts.baseURL,
    basePath: '/v1/auth',
    trustedOrigins: opts.trustedOrigins,
    database: mongodbAdapter(opts.db),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => opts.sendResetPassword({ email: user.email, url }),
    },
    session: {
      expiresIn: SESSION_MAX_AGE,
      updateAge: 60 * 60,
      freshAge: 60 * 15,
    },
    databaseHooks: {
      session: {
        create: {
          // Approved staff only: refuse to start a session for other roles or banned users.
          before: async (session, ctx) => {
            const user = (await ctx?.context.internalAdapter.findUserById(session.userId)) as
              | { role?: string | null; banned?: boolean | null }
              | null;
            if (!user || user.banned || !portalRoles.has(user.role ?? '')) {
              throw new APIError('FORBIDDEN', { message: 'This account does not have access to the staff portal.' });
            }
          },
        },
      },
    },
    advanced: {
      cookiePrefix: 'itti',
      useSecureCookies: opts.baseURL.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      ipAddress: { ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'] },
      ...(opts.cookieDomain
        ? { crossSubDomainCookies: { enabled: true, domain: opts.cookieDomain } }
        : {}),
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 15 * 60, max: 3 },
        '/reset-password': { window: 15 * 60, max: 5 },
        '/change-password': { window: 15 * 60, max: 5 },
      },
    },
    plugins: [
      admin({
        ac,
        defaultRole: 'editor',
        adminRoles: ['super_admin', 'admin'],
        roles: {
          super_admin: adminRole,
          admin: adminRole,
          editor: staffRole,
          admissions: staffRole,
        },
      }),
      // Installed so it can be switched on later; not required at sign-in for now.
      twoFactor({ issuer: 'ITTI Ghana' }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth['$Infer']['Session'];
