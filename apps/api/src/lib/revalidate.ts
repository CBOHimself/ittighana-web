import { env } from '../env';

/**
 * Tell the Next.js site to refresh cached pages after an admin change.
 * Tags follow the convention: "<entity>" and "<entity>:<slug>".
 */
export async function revalidate(tags: string[]) {
  try {
    await fetch(`${env.WEB_PUBLIC_URL.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': env.REVALIDATE_SECRET },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn('[revalidate] failed', tags, (err as Error).message);
  }
}
