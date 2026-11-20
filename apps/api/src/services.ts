import { createAuth } from '@itti/auth';
import { nativeDb } from '@itti/db';
import { Mailer, templates } from '@itti/email';
import { LocalDiskStorage } from '@itti/media';
import { allowedOrigins, env } from './env';

export const mailer = new Mailer({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  user: env.SMTP_USER,
  pass: env.SMTP_PASS,
  from: env.MAIL_FROM,
});

export const storage = new LocalDiskStorage({
  publicDir: env.MEDIA_PUBLIC_DIR,
  privateDir: env.MEDIA_PRIVATE_DIR,
  publicUrl: env.MEDIA_PUBLIC_URL,
});

let _auth: ReturnType<typeof createAuth> | null = null;

/** Auth needs a live DB handle, so it's created lazily after connectDb(). */
export function auth() {
  _auth ??= createAuth({
    db: nativeDb(),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.API_PUBLIC_URL,
    trustedOrigins: allowedOrigins,
    cookieDomain: env.COOKIE_DOMAIN || undefined,
    portalRoles: env.PORTAL_ROLES,
    sendResetPassword: async ({ email, url }) => {
      await mailer.send({ to: email, ...templates.resetPassword(url) });
    },
  });
  return _auth;
}

export const adminUrl = (path: string) => `${env.ADMIN_PUBLIC_URL.replace(/\/$/, '')}${path}`;
