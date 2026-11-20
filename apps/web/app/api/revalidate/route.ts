import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/** Called by the API after admin edits: POST { tags: string[] } with x-revalidate-secret. */
export async function POST(req: NextRequest) {
  if (req.headers.get('x-revalidate-secret') !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { tags } = (await req.json().catch(() => ({ tags: [] }))) as { tags?: string[] };
  const valid = (tags ?? []).filter((t) => typeof t === 'string' && t.length < 200).slice(0, 50);
  for (const tag of valid) revalidateTag(tag, 'max');
  return NextResponse.json({ revalidated: valid });
}
