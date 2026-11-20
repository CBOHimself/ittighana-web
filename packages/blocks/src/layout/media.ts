import type { RenderContext } from './context';

const PLACEHOLDER = (token: string) => {
  const [label = '', size] = token.split('|');
  const m = size?.match(/^(\d+)x(\d+)$/);
  const w = m ? Number(m[1]) : 1200;
  const h = m ? Number(m[2]) : 800;
  const big = Math.max(14, Math.round(Math.min(w, h) / 20));
  const small = Math.max(10, Math.round(Math.min(w, h) / 34));
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#e6e6e6"/><rect x="${w * 0.03}" y="${h * 0.04}" width="${w * 0.94}" height="${h * 0.92}" fill="none" stroke="#cbc8cc" stroke-width="4" stroke-dasharray="16 12"/><text x="${w / 2}" y="${h / 2 - 5}" font-family="Arial" font-size="${big}" fill="#002147" text-anchor="middle">ITTI</text><text x="${w / 2}" y="${h / 2 + big}" font-family="Arial" font-size="${small}" fill="#3277ae" text-anchor="middle">${label.replace(/[<&>"]/g, '')}</text></svg>`,
  )}`;
};

/** Resolve a stored media reference to a URL the browser can load. */
export function mediaSrc(url: unknown, ctx: Pick<RenderContext, 'mediaBase'>): string | undefined {
  if (typeof url !== 'string' || !url) return undefined;
  if (url.startsWith('placeholder:')) return PLACEHOLDER(url.slice(12));
  if (url.startsWith('/wp-content/') || url.startsWith('/uploads/')) return `${ctx.mediaBase}${url}`;
  return url;
}

export const isPlaceholder = (url: unknown) => typeof url === 'string' && (url.startsWith('placeholder:') || url.startsWith('data:image/svg+xml'));

/** Rewrite media paths inside stored HTML (text editor content, post bodies). */
export function mediaHtml(html: string, ctx: Pick<RenderContext, 'mediaBase'>) {
  if (!ctx.mediaBase) return html;
  return html.replace(/(["'(])\/wp-content\/uploads\//g, `$1${ctx.mediaBase}/wp-content/uploads/`);
}

const squash = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The bundled fallback for a media URL or placeholder token, if any.
 * Placeholder tokens carry the file name as their label, so both forms match.
 */
export function fallbackFor(url: string | undefined, ctx: RenderContext): string | undefined {
  if (!url || !ctx.imageFallbacks?.length) return undefined;
  const name = squash(url.startsWith('placeholder:') ? url.slice(12).split('|')[0]! : url.split('/').pop() ?? '');
  return ctx.imageFallbacks.find((f) => name.includes(squash(f.match)))?.src;
}
