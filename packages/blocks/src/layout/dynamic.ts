import type { DynamicValue } from '@itti/schemas';
import type { RecordContext, RenderContext } from './context';

const isDyn = (v: unknown): v is DynamicValue => Boolean(v && typeof v === 'object' && '$dyn' in (v as object));

const fmtDate = (d?: string) =>
  d ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Africa/Accra' }).format(new Date(d)) : '';

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Minimal PHP date() formatter (Accra is UTC+0, so UTC parts are local time). */
export function phpDate(iso: string, format: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getUTCHours();
  const map: Record<string, string> = {
    Y: String(d.getUTCFullYear()), y: String(d.getUTCFullYear()).slice(2),
    m: pad(d.getUTCMonth() + 1), n: String(d.getUTCMonth() + 1), F: MONTHS[d.getUTCMonth()]!, M: MONTHS[d.getUTCMonth()]!.slice(0, 3),
    d: pad(d.getUTCDate()), j: String(d.getUTCDate()), l: DAYS[d.getUTCDay()]!, D: DAYS[d.getUTCDay()]!.slice(0, 3),
    H: pad(h), G: String(h), h: pad(h % 12 || 12), g: String(h % 12 || 12), i: pad(d.getUTCMinutes()), s: pad(d.getUTCSeconds()),
    a: h < 12 ? 'am' : 'pm', A: h < 12 ? 'AM' : 'PM',
  };
  let out = '';
  for (let i = 0; i < format.length; i++) {
    const c = format[i]!;
    if (c === '\\') { out += format[++i] ?? ''; continue; }
    out += map[c] ?? c;
  }
  return out;
}

const dateOf = (iso: string | undefined, format?: string) => (!iso ? '' : format ? phpDate(iso, format) : fmtDate(iso));

function resolveOne(v: DynamicValue, rec?: RecordContext): unknown {
  const r = resolveRaw(v, rec);
  if ((v.before || v.after) && (typeof r === 'string' || typeof r === 'number') && r !== '') return `${v.before ?? ''}${r}${v.after ?? ''}`;
  return r;
}

function resolveRaw(v: DynamicValue, rec?: RecordContext): unknown {
  switch (v.$dyn) {
    case 'field': {
      const f = rec?.fields?.[v.field ?? ''];
      return f === undefined || f === null || f === '' ? (v.fallback ?? '') : f;
    }
    case 'title':
      return rec?.title ?? '';
    case 'excerpt':
      return rec?.excerpt ?? '';
    case 'featured-image':
      return rec?.cover ?? v.fallback ?? undefined;
    case 'date':
      return dateOf(rec?.publishedAt, v.format);
    case 'author':
      return rec?.author ?? '';
    case 'archive-title':
      return rec?.title ?? '';
    case 'now':
      return dateOf(new Date().toISOString(), v.format);
    default:
      return undefined;
  }
}

/** Deep-resolve dynamic placeholders in widget props against the current record. */
export function resolveProps<T>(value: T, ctx: RenderContext, rec = ctx.record): T {
  if (isDyn(value)) return resolveOne(value, rec) as T;
  if (Array.isArray(value)) return value.map((v) => resolveProps(v, ctx, rec)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveProps(v, ctx, rec);
    return out as T;
  }
  return value;
}

/** Normalise an image-ish value ({url}, string, MediaRef) to {url, alt}. */
export function asImage(v: unknown): { url: string; alt: string } | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return { url: v, alt: '' };
  if (typeof v === 'object' && 'url' in (v as object)) {
    const o = v as { url?: unknown; alt?: unknown };
    return typeof o.url === 'string' && o.url ? { url: o.url, alt: typeof o.alt === 'string' ? o.alt : '' } : undefined;
  }
  return undefined;
}

export function asLink(v: unknown): { href: string; external: boolean } | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return { href: v, external: false };
  const o = v as { url?: unknown; is_external?: unknown };
  if (typeof o.url !== 'string' || !o.url) return undefined;
  return { href: o.url, external: o.is_external === 'on' || o.is_external === 'true' || o.is_external === true };
}
