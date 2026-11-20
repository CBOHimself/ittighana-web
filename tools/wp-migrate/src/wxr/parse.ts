/** WordPress eXtended RSS (WXR) export → typed items. */
import { XMLParser } from 'fast-xml-parser';
import { unserialize } from 'php-serialize';

export type WxrItem = {
  id: number;
  title: string;
  link: string;
  slug: string;
  type: string;
  status: string;
  parent: number;
  order: number;
  date: string;
  content: string;
  excerpt: string;
  attachmentUrl?: string;
  categories: Array<{ domain: string; slug: string; name: string }>;
  meta: Record<string, string>;
};

export type Wxr = {
  site: { title: string; link: string; description: string };
  items: WxrItem[];
  terms: Array<{ taxonomy: string; slug: string; name: string; id: number }>;
};

const text = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object' && '#text' in (v as object)) return String((v as Record<string, unknown>)['#text']);
  return String(v);
};
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function parseWxr(xml: string): Wxr {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    cdataPropName: false,
    parseTagValue: false,
    trimValues: false,
    processEntities: true,
    isArray: (name) => ['item', 'wp:postmeta', 'category', 'wp:term', 'wp:category'].includes(name),
  });
  const doc = parser.parse(xml);
  const ch = doc.rss.channel;
  const items: WxrItem[] = arr(ch.item).map((it: any) => {
    const meta: Record<string, string> = {};
    for (const m of arr(it['wp:postmeta'])) meta[text((m as any)['wp:meta_key'])] = text((m as any)['wp:meta_value']);
    return {
      id: Number(text(it['wp:post_id'])),
      title: text(it.title).trim(),
      link: text(it.link),
      slug: text(it['wp:post_name']),
      type: text(it['wp:post_type']),
      status: text(it['wp:status']),
      parent: Number(text(it['wp:post_parent']) || 0),
      order: Number(text(it['wp:menu_order']) || 0),
      date: (text(it['wp:post_date_gmt']).startsWith('0000') ? '' : text(it['wp:post_date_gmt'])) || text(it['wp:post_date']),
      content: text(it['content:encoded']),
      excerpt: text(it['excerpt:encoded']),
      attachmentUrl: text(it['wp:attachment_url']) || undefined,
      categories: arr(it.category).map((c: any) => ({ domain: c['@_domain'] ?? '', slug: c['@_nicename'] ?? '', name: text(c).trim() })),
      meta,
    };
  });
  const terms = arr(ch['wp:term']).map((t: any) => ({
    taxonomy: text(t['wp:term_taxonomy']),
    slug: text(t['wp:term_slug']),
    name: text(t['wp:term_name']),
    id: Number(text(t['wp:term_id'])),
  }));
  for (const c of arr(ch['wp:category'])) {
    terms.push({ taxonomy: 'category', slug: text((c as any)['wp:category_nicename']), name: text((c as any)['wp:cat_name']), id: Number(text((c as any)['wp:term_id'])) });
  }
  return { site: { title: text(ch.title), link: text(ch.link), description: text(ch.description) }, items, terms };
}

/** PHP-serialized meta → JS (null on failure). */
export function php<T = any>(v: string | undefined): T | null {
  if (!v) return null;
  try {
    return unserialize(v, {}, { strict: false }) as T;
  } catch {
    return null;
  }
}

export function json<T = any>(v: string | undefined): T | null {
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}
