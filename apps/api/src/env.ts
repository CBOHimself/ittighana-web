import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().optional(),
  API_PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  API_PUBLIC_URL: z.string().url(),
  WEB_PUBLIC_URL: z.string().url(),
  ADMIN_PUBLIC_URL: z.string().url(),
  COOKIE_DOMAIN: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(16),
  REVALIDATE_SECRET: z.string().min(8),
  MEDIA_PUBLIC_DIR: z.string().default('./storage/media'),
  MEDIA_PRIVATE_DIR: z.string().default('./storage/private-uploads'),
  MEDIA_PUBLIC_URL: z.string().url(),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('ITTI Ghana <no-reply@ittighana.com>'),
  ADMIN_NOTIFY_EMAIL: z.string().default(''),
  TURNSTILE_SECRET: z.string().optional(),
  /** Roles allowed to sign in to the staff portal (comma-separated). */
  PORTAL_ROLES: z
    .string()
    .default('super_admin,admin')
    .transform((v) => v.split(',').map((r) => r.trim()).filter(Boolean)),
  /** Failed sign-ins (per account, within 30 minutes) before the account is locked. */
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).default(5),
  /** How long a locked account stays locked. */
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).default(15),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', z.treeifyError(parsed.error));
  process.exit(1);
}
export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

/** Distinct origins (scheme + host) of the web site and staff portal, for CORS and auth. */
export const allowedOrigins = [...new Set([env.WEB_PUBLIC_URL, env.ADMIN_PUBLIC_URL].map((u) => new URL(u).origin))];
