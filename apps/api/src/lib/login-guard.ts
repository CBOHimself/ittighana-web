import { nativeDb } from '@itti/db';
import { env } from '../env';
import { clientIp } from './http';

/**
 * Account lockout for the staff portal sign-in.
 *
 * Better Auth already rate-limits /sign-in/email per IP (5 a minute). This adds a
 * per-account counter so a password can't be guessed slowly from many IPs:
 * after LOGIN_MAX_ATTEMPTS failures within the window the account is locked for
 * LOGIN_LOCK_MINUTES. Every attempt is written to the audit log.
 */
type Attempt = { _id: string; failures: number; firstFailureAt: Date; lockedUntil?: Date | null };

const collection = () => nativeDb().collection<Attempt>('login_attempts');
const WINDOW_MS = 30 * 60 * 1000;

const normalise = (email: unknown) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

async function auditLogin(action: string, email: string, headers: Headers, extra?: Record<string, unknown>) {
  try {
    await nativeDb()
      .collection('audit_log')
      .insertOne({ action, entity: 'auth', userEmail: email || undefined, ip: clientIp(headers), diff: extra, createdAt: new Date(), updatedAt: new Date() });
  } catch (err) {
    console.warn('[login-guard] audit failed', err);
  }
}

/** Minutes left on a lock, or 0 if the account can try again. */
async function lockedFor(email: string) {
  const row = await collection().findOne({ _id: email });
  if (!row?.lockedUntil) return 0;
  const ms = row.lockedUntil.getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60_000) : 0;
}

async function recordFailure(email: string) {
  const now = new Date();
  const row = await collection().findOne({ _id: email });
  const fresh = !row || now.getTime() - row.firstFailureAt.getTime() > WINDOW_MS;
  const failures = fresh ? 1 : row.failures + 1;
  const lockedUntil = failures >= env.LOGIN_MAX_ATTEMPTS ? new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60_000) : null;
  await collection().updateOne(
    { _id: email },
    { $set: { failures, firstFailureAt: fresh ? now : row!.firstFailureAt, lockedUntil } },
    { upsert: true },
  );
  return { failures, locked: Boolean(lockedUntil) };
}

const clearFailures = (email: string) => collection().deleteOne({ _id: email });

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });

/**
 * Wraps Better Auth's handler for POST /v1/auth/sign-in/email.
 * Other auth routes pass straight through.
 */
export async function guardedSignIn(req: Request, handler: (r: Request) => Promise<Response>) {
  const body = (await req.clone().json().catch(() => ({}))) as { email?: unknown };
  const email = normalise(body.email);
  if (!email) return handler(req);

  const minutes = await lockedFor(email);
  if (minutes > 0) {
    await auditLogin('sign-in.blocked', email, req.headers, { reason: 'locked' });
    return json(
      423,
      { code: 'ACCOUNT_LOCKED', message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` },
      { 'Retry-After': String(minutes * 60) },
    );
  }

  const res = await handler(req);
  if (res.ok) {
    await clearFailures(email);
    await auditLogin('sign-in.success', email, req.headers);
  } else if (res.status === 401) {
    const { failures, locked } = await recordFailure(email);
    await auditLogin('sign-in.failed', email, req.headers, { failures, locked });
    if (locked) {
      return json(423, { code: 'ACCOUNT_LOCKED', message: `Too many failed attempts. Try again in ${env.LOGIN_LOCK_MINUTES} minutes.` });
    }
  } else if (res.status === 403) {
    await auditLogin('sign-in.denied', email, req.headers, { reason: 'not a portal role or banned' });
  }
  return res;
}

/** Index for the lockout collection (expires rows a day after their last failure). */
export async function ensureLoginGuardIndexes() {
  await collection().createIndex({ firstFailureAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
}
