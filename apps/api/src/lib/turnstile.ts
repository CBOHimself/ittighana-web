import { env } from '../env';

/** Verify a Cloudflare Turnstile token. Skipped when no secret is configured (local dev). */
export async function verifyTurnstile(token: string | undefined, ip?: string) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const data = (await res.json()) as { success: boolean };
  return data.success;
}
