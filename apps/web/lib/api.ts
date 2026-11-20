import { connection } from 'next/server';
import 'server-only';

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Opts = {
  /** Cache tags; the API calls /api/revalidate with these after admin edits. */
  tags?: string[];
  /** Fallback time-based revalidation in seconds. */
  revalidate?: number | false;
  query?: Record<string, string | number | undefined>;
};

/** Server-side fetch to the ITTI API with Next.js data cache + tag revalidation. */
export async function api<T>(path: string, { tags = [], revalidate = 3600, query }: Opts = {}): Promise<T> {
  // Render pages at request time (cheap) while the *data* stays in Next's data
  // cache until the API revalidates its tags. This also lets `next build` run in
  // CI without the API being reachable.
  await connection();
  const url = new URL(`${API}/v1${path}`);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url, { next: { tags, revalidate } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Like api(), but returns null on 404 (for notFound() handling). */
export async function apiOrNull<T>(path: string, opts?: Opts): Promise<T | null> {
  try {
    return await api<T>(path, opts);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export const publicApiUrl = API;
