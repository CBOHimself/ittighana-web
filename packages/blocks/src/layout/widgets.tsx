import type { LayoutNode } from '@itti/schemas';
import { balanceHtml } from './balance';
import type { ReactNode } from 'react';
import type { ListItem, RenderContext } from './context';
import { asImage, asLink } from './dynamic';
import { Icon, type IconValue } from './Icon';
import { fallbackFor, mediaHtml, mediaSrc } from './media';

export type WidgetProps = { node: LayoutNode; p: Record<string, any>; ctx: RenderContext; render: (nodes: LayoutNode[] | undefined, ctx?: RenderContext) => ReactNode };

const cleanHtml = (h: unknown, ctx: RenderContext) =>
  typeof h === 'string' ? mediaHtml(balanceHtml(h.replace(/<!--\s*\/?wp:[^>]*-->/g, '')), ctx) : '';

const TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p']);

export function A({ link, className, children, ctx }: { link: unknown; className?: string; children: ReactNode; ctx?: RenderContext }) {
  const l = asLink(link);
  if (!l) return <span className={className}>{children}</span>;
  const href = ctx && /\/wp-content\/uploads\//.test(l.href) ? (mediaSrc(l.href, ctx) ?? l.href) : l.href;
  return (
    <a href={href} className={className} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

export function Img({ src, alt = '', ctx, className }: { src: unknown; alt?: string; ctx: RenderContext; className?: string }) {
  const img = asImage(src);
  if (!img) return null;
  // A bundled copy (logos) replaces a missing file, and stands by in case the media server fails.
  const fallback = fallbackFor(img.url, ctx);
  const url = img.url.startsWith('placeholder:') && fallback ? fallback : mediaSrc(img.url, ctx);
  if (!url) return null;
  // Placeholders are inline SVGs: load them eagerly so they hold the layout like the real image would.
  return (
    <img
      src={url}
      alt={alt || img.alt || ''}
      loading={url.startsWith('data:') || fallback ? undefined : 'lazy'}
      className={className}
      data-fallback={fallback && fallback !== url ? fallback : undefined}
    />
  );
}

export function Heading({ p, ctx }: WidgetProps) {
  const Tag = (TAGS.has(p.header_size) ? p.header_size : 'h2') as 'h2';
  const html = { __html: cleanHtml(String(p.title ?? ''), ctx) };
  return (
    <Tag className="w-title">
      {p.link?.url ? <A link={p.link} ctx={ctx}><span dangerouslySetInnerHTML={html} /></A> : <span dangerouslySetInnerHTML={html} />}
    </Tag>
  );
}

export const TextEditor = ({ p, ctx }: WidgetProps) => <div className="w-text" dangerouslySetInnerHTML={{ __html: cleanHtml(p.editor, ctx) }} />;

export function Button({ p, ctx }: WidgetProps) {
  const icon = p.selected_icon?.value ? <Icon icon={p.selected_icon} ctx={ctx} /> : null;
  return (
    <A link={p.link ?? { url: '#' }} className="w-btn" ctx={ctx}>
      {icon && p.icon_align !== 'right' && icon}
      <span dangerouslySetInnerHTML={{ __html: String(p.text ?? 'Click here') }} />
      {icon && p.icon_align === 'right' && icon}
    </A>
  );
}

export const IconWidget = ({ p, ctx }: WidgetProps) => (
  <div className="w-icon-wrap">
    <A link={p.link} className="w-icon" ctx={ctx}>
      <Icon icon={p.selected_icon as IconValue} ctx={ctx} />
    </A>
  </div>
);

/** Elementor shows its stock placeholder image when an image widget has no image set. */
const EMPTY_IMAGE = { url: 'placeholder:Image|1200x800', alt: '' };

/** "Post featured image": renders nothing when the record has no image (and no fallback). */
export function FeaturedImage(props: WidgetProps) {
  return asImage(props.p.image) ? <Image {...props} /> : null;
}

export function Image({ p, ctx }: WidgetProps) {
  const img = asImage(p.image) ?? EMPTY_IMAGE;
  const el = <Img src={img} ctx={ctx} />;
  const link = p.link_to === 'custom' ? p.link : p.link_to === 'file' ? { url: img.url } : undefined;
  const linked = link ? <A link={link} ctx={ctx}>{el}</A> : el;
  const caption = p.caption_source === 'custom' ? p.caption : undefined;
  return caption ? (
    <figure>
      {linked}
      <figcaption>{caption}</figcaption>
    </figure>
  ) : (
    linked
  );
}

export const IconList = ({ p, ctx }: WidgetProps) => (
  <ul className="w-il">
    {(p.icon_list ?? []).map((it: any, i: number) => {
      const inner = (
        <>
          {it.selected_icon?.value && (
            <span className="w-il-icon">
              <Icon icon={it.selected_icon} ctx={ctx} />
            </span>
          )}
          <span className="w-il-text" dangerouslySetInnerHTML={{ __html: cleanHtml(it.text ?? '', ctx) }} />
        </>
      );
      return (
        <li key={it._id ?? i} className="w-il-item">
          {it.link?.url ? <A link={it.link} ctx={ctx}>{inner}</A> : inner}
        </li>
      );
    })}
  </ul>
);

export const Spacer = () => <div className="w-spacer" />;
export const Divider = () => <div className="w-divider" role="separator" />;
export const Html = ({ p, ctx }: WidgetProps) => <div className="w-html" dangerouslySetInnerHTML={{ __html: cleanHtml(p.html, ctx) }} />;

export function GoogleMaps({ p }: WidgetProps) {
  const q = encodeURIComponent(String(p.address ?? 'Accra, Ghana'));
  const z = p.zoom?.size ?? 14;
  return (
    <div className="w-maps">
      <iframe loading="lazy" title={String(p.address ?? 'Map')} src={`https://maps.google.com/maps?q=${q}&t=m&z=${z}&output=embed&iwloc=near`} />
    </div>
  );
}

export const Blockquote = ({ p }: WidgetProps) => (
  <blockquote className="w-bq">
    <p className="w-bq-content">{p.blockquote_content}</p>
    {p.author_name && <cite className="w-bq-author">{p.author_name}</cite>}
  </blockquote>
);

export function IconBox({ p, ctx }: WidgetProps) {
  const Tag = (TAGS.has(p.title_size) ? p.title_size : 'h3') as 'h3';
  const pos = (v: unknown) => (typeof v === 'string' && ['top', 'left', 'right', 'bottom'].includes(v.trim()) ? v.trim() : '');
  const cls = [
    'w-ib',
    `w-ib-pos-${pos(p.position) || 'top'}`,
    pos(p.position_tablet) && `w-ib-pos-t-${pos(p.position_tablet)}`,
    pos(p.position_mobile) && `w-ib-pos-m-${pos(p.position_mobile)}`,
    p.content_vertical_alignment && `w-ib-va-${p.content_vertical_alignment}`,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
      {p.selected_icon?.value && (
        <div className="w-ib-icon-wrap">
          <A link={p.link} className="w-ib-icon" ctx={ctx}>
            <Icon icon={p.selected_icon} ctx={ctx} />
          </A>
        </div>
      )}
      <div className="w-ib-content">
        {p.title_text && (
          <Tag className="w-ib-title">
            <A link={p.link} ctx={ctx}>
              <span dangerouslySetInnerHTML={{ __html: cleanHtml(p.title_text, ctx) }} />
            </A>
          </Tag>
        )}
        {p.description_text && <p className="w-ib-desc" dangerouslySetInnerHTML={{ __html: cleanHtml(p.description_text, ctx) }} />}
      </div>
    </div>
  );
}

export function ImageBox({ p, ctx }: WidgetProps) {
  const Tag = (TAGS.has(p.title_size) ? p.title_size : 'h3') as 'h3';
  return (
    <div className="w-ib">
      {p.image && (
        <figure className="w-ib-img" style={p.image_size?.size ? { width: `${p.image_size.size}${p.image_size.unit ?? '%'}` } : undefined}>
          <A link={p.link} ctx={ctx}>
            <Img src={p.image} ctx={ctx} />
          </A>
        </figure>
      )}
      <div className="w-ib-content">
        {p.title_text && <Tag className="w-ib-title">{p.title_text}</Tag>}
        {p.description_text && <p className="w-ib-desc" dangerouslySetInnerHTML={{ __html: cleanHtml(p.description_text, ctx) }} />}
      </div>
    </div>
  );
}

export function CallToAction({ p, ctx }: WidgetProps) {
  const bg = asImage(p.bg_image);
  const Tag = (TAGS.has(p.title_tag) ? p.title_tag : 'h2') as 'h2';
  const body = (
    <div className="w-cta">
      {bg && <div className="w-cta-image" style={{ backgroundImage: `url("${mediaSrc(bg.url, ctx)}")` }} />}
      <div className="w-cta-overlay" />
      <div className="w-cta-content">
        {p.title && <Tag className="w-cta-title" dangerouslySetInnerHTML={{ __html: cleanHtml(p.title, ctx) }} />}
        {p.description && <div className="w-cta-desc" dangerouslySetInnerHTML={{ __html: cleanHtml(p.description, ctx) }} />}
        {p.button && (
          <div>
            <A link={p.link} className="w-btn" ctx={ctx}>
              {p.button}
            </A>
          </div>
        )}
      </div>
    </div>
  );
  return p.link_click === 'box' ? <A link={p.link} ctx={ctx}>{body}</A> : body;
}

const SOCIAL_BG: Record<string, string> = {
  facebook: '#3b5998', twitter: '#1da1f2', 'x-twitter': '#000', linkedin: '#0077b5', instagram: '#262626', youtube: '#cd201f',
  tiktok: '#000', whatsapp: '#25d366', pinterest: '#bd081c', telegram: '#2ca5e0', envelope: '#ea4335',
};
export const SocialIcons = ({ p, ctx }: WidgetProps) => (
  <div className="w-social">
    {(p.social_icon_list ?? []).map((it: any, i: number) => {
      const name = String(it.social_icon?.value ?? '').replace(/^fa[brs]? fa-/, '');
      const l = asLink(it.link);
      return (
        // Brand colours only for the "Official Color" setting; "Custom" colours come from the widget styles.
        <a key={it._id ?? i} href={l?.href ?? '#'} target="_blank" rel="noopener noreferrer" aria-label={name} style={p.icon_color === 'custom' ? undefined : { backgroundColor: SOCIAL_BG[name] }}>
          <Icon icon={it.social_icon} ctx={ctx} />
        </a>
      );
    })}
  </div>
);

const SHARE: Record<string, { icon: string; color: string; url: (u: string, t: string) => string }> = {
  facebook: { icon: 'fab fa-facebook-f', color: '#3b5998', url: (u) => `https://www.facebook.com/sharer.php?u=${u}` },
  linkedin: { icon: 'fab fa-linkedin-in', color: '#0077b5', url: (u) => `https://www.linkedin.com/shareArticle?mini=true&url=${u}` },
  twitter: { icon: 'fab fa-x-twitter', color: '#000', url: (u, t) => `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
  pinterest: { icon: 'fab fa-pinterest', color: '#bd081c', url: (u) => `https://www.pinterest.com/pin/create/button/?url=${u}` },
  email: { icon: 'fas fa-envelope', color: '#ea4335', url: (u, t) => `mailto:?subject=${t}&body=${u}` },
  whatsapp: { icon: 'fab fa-whatsapp', color: '#25d366', url: (u, t) => `https://api.whatsapp.com/send?text=${t}%20${u}` },
};
export function ShareButtons({ p, ctx }: WidgetProps) {
  const u = encodeURIComponent(`${ctx.siteUrl}${ctx.path}`);
  const t = encodeURIComponent(ctx.record?.title ?? '');
  return (
    <div className="w-share">
      {(p.share_buttons ?? []).map((b: any, i: number) => {
        const s = SHARE[b.button ?? 'facebook'];
        if (!s) return null;
        return (
          <a key={b._id ?? i} href={s.url(u, t)} target="_blank" rel="noopener noreferrer" style={{ background: s.color }} aria-label={`Share on ${b.button ?? 'facebook'}`}>
            <i className={s.icon} aria-hidden />
          </a>
        );
      })}
    </div>
  );
}

export function PostInfo({ p, ctx }: WidgetProps) {
  const r = ctx.record;
  return (
    <ul className="w-pi">
      {(p.icon_list ?? []).map((it: any, i: number) => {
        const text =
          it.type === 'date' ? (r?.publishedAt ? new Date(r.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '')
            : it.type === 'author' ? (r?.author ?? 'ITTI')
              : it.type === 'time' ? (r?.publishedAt ? new Date(r.publishedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '')
                : it.type === 'terms' ? ''
                  : (it.text ?? r?.author ?? '');
        if (!text) return null;
        return (
          <li key={it._id ?? i} className="w-pi-item">
            {it.selected_icon?.value && <span className="w-pi-icon"><Icon icon={it.selected_icon} ctx={ctx} /></span>}
            <span className="w-pi-text">{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PostContent({ ctx, render }: WidgetProps) {
  const r = ctx.record;
  if (r?.layout?.length) return <>{render(r.layout, { ...ctx, record: { ...r, layout: undefined } })}</>;
  // Story text: the template "body" field (admin-authored) or imported WordPress HTML.
  const body = typeof r?.fields?.body === 'string' && r.fields.body.trim() ? r.fields.body : (r?.html ?? '');
  return <div className="w-text w-post-content-html" dangerouslySetInnerHTML={{ __html: cleanHtml(body, ctx) }} />;
}

export const AuthorBox = ({ p, ctx }: WidgetProps) => (
  <div className="w-author-box">
    <strong>{ctx.record?.author ?? p.author_name}</strong>
  </div>
);

export function PostNavigation({ p, ctx, node }: WidgetProps) {
  const nav = ctx.data[node.id] as { prev?: ListItem; next?: ListItem } | undefined;
  return (
    <nav className="w-post-nav" style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
      {nav?.prev?.path ? <a href={nav.prev.path}>‹ {p.prev_label ?? 'Previous'}<br /><small>{nav.prev.title}</small></a> : <span />}
      {nav?.next?.path ? <a href={nav.next.path} style={{ textAlign: 'right' }}>{p.next_label ?? 'Next'} ›<br /><small>{nav.next.title}</small></a> : <span />}
    </nav>
  );
}

export const Zigzag = ({ p, ctx }: WidgetProps) => (
  <div className="w-zz">
    {(p.image_zigzag_items ?? []).map((it: any, i: number) => (
      <div key={it._id ?? i} className="w-zz-item">
        <div className="w-zz-media">
          <Img src={it.image_graphic_image} ctx={ctx} />
        </div>
        <div className="w-zz-text">
          {it.image_title && <h3 className="w-zz-title w-title">{it.image_title}</h3>}
          {it.image_description && <div className="w-zz-desc w-text" dangerouslySetInnerHTML={{ __html: cleanHtml(it.image_description, ctx) }} />}
          {it.image_button_text && (
            <div style={{ marginTop: 20 }}>
              <A link={it.image_button_link ?? { url: '#' }} className="w-btn" ctx={ctx}>
                {it.image_button_text}
              </A>
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
);

export function Gallery({ p, ctx }: WidgetProps) {
  const cols = Number(p.gallery_columns ?? 4);
  return (
    <div className="w-gallery" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {(p.gallery ?? []).map((g: any, i: number) => (
        <a key={g.id ?? i} href={mediaSrc(g.url, ctx)} target="_blank" rel="noopener">
          <Img src={g} ctx={ctx} />
        </a>
      ))}
    </div>
  );
}

export function NestedAccordion({ p, node, ctx, render }: WidgetProps) {
  return (
    <div className="w-acc">
      {(p.items ?? []).map((it: any, i: number) => (
        <details key={it._id ?? i} className="w-acc-item" open={i === 0 && p.default_state !== 'all_collapsed' ? true : undefined}>
          <summary className="w-acc-title">
            <span>{it.item_title}</span>
            <i className="fas fa-chevron-down w-acc-chevron" aria-hidden />
          </summary>
          <div className="w-acc-panel">{render(node.children?.[i] ? [node.children[i]!] : [], ctx)}</div>
        </details>
      ))}
    </div>
  );
}

export const Toggle = ({ p, ctx }: WidgetProps) => (
  <div className="w-acc">
    {(p.tabs ?? []).map((t: any, i: number) => (
      <details key={t._id ?? i} className="w-acc-item">
        <summary className="w-acc-title">
          <span>{t.tab_title}</span>
          <i className="fas fa-chevron-down w-acc-chevron" aria-hidden />
        </summary>
        <div className="w-acc-body" dangerouslySetInnerHTML={{ __html: cleanHtml(t.tab_content, ctx) }} />
      </details>
    ))}
  </div>
);

/* ─── Data-driven lists (posts, loop grid, post grid, embedded template) ── */
const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');

export function Posts({ p, node, ctx }: WidgetProps) {
  const items = (ctx.data[node.id] as ListItem[] | undefined) ?? [];
  const skin = String(p._skin || 'classic');
  const cols = Number(p[`${skin}_columns`] ?? 3);
  const thumb = p[`${skin}_thumbnail`] ?? 'top';
  const showTitle = p[`${skin}_show_title`] !== '';
  const showExcerpt = p[`${skin}_show_excerpt`] !== '';
  const showMore = p[`${skin}_show_read_more`] !== '';
  const meta: string[] = Array.isArray(p[`${skin}_meta_data`]) ? p[`${skin}_meta_data`] : ['date'];
  const more = typeof p[`${skin}_read_more_text`] === 'string' ? p[`${skin}_read_more_text`] : 'Read More »';
  const excerptLen = Number(p[`${skin}_excerpt_length`] ?? 25);
  return (
    <div className="w-posts" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it, i) => (
        <article key={it._id ?? i} className={`w-post is-${skin} ${thumb === 'left' ? 'is-classic-left' : ''}`}>
          {thumb !== 'none' && it.cover && (
            <a href={it.path ?? '#'} className="w-post-thumb">
              <Img src={it.cover} ctx={ctx} />
            </a>
          )}
          <div className="w-post-content">
            {showTitle && (
              <h3 className="w-post-title">
                <a href={it.path ?? '#'}>{it.title}</a>
              </h3>
            )}
            {meta.length > 0 && (
              <div className="w-post-meta">
                {meta.map((m) => (m === 'date' ? fmt(it.publishedAt) : m === 'author' ? (it.author ?? '') : '')).filter(Boolean).join(` ${p[`${skin}_meta_separator`] ?? '•'} `)}
              </div>
            )}
            {showExcerpt && it.excerpt && <p className="w-post-excerpt">{it.excerpt.split(/\s+/).slice(0, excerptLen).join(' ')}</p>}
            {showMore && (
              <a href={it.path ?? '#'} className="w-post-more">
                {more}
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function PostGrid({ p, node, ctx }: WidgetProps) {
  const items = (ctx.data[node.id] as ListItem[] | undefined) ?? [];
  const cols = Number(p.grid_column ?? 3);
  return (
    <div className="w-posts" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it, i) => (
        <article key={it._id ?? i} className="w-post is-cards">
          {it.cover && (
            <a href={it.path ?? '#'} className="w-post-thumb">
              <Img src={it.cover} ctx={ctx} />
            </a>
          )}
          <div className="w-post-content">
            <h3 className="w-post-title">
              <a href={it.path ?? '#'}>{it.title}</a>
            </h3>
            <div className="w-post-meta">{fmt(it.publishedAt)}</div>
            {it.excerpt && <p className="w-post-excerpt">{it.excerpt.split(/\s+/).slice(0, 20).join(' ')}…</p>}
            <a href={it.path ?? '#'} className="w-post-more">
              {p.read_more_label ?? 'Read More'}
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

export function LoopGrid({ p, node, ctx, render }: WidgetProps) {
  const items = (ctx.data[node.id] as ListItem[] | undefined) ?? [];
  const tpl = ctx.templates[String(p.template_id)] ?? [];
  const cols = Number(p.columns ?? 3);
  if (!items.length) return <p className="w-text">{p.nothing_found_message_text}</p>;
  return (
    <div className="w-loop" style={{ display: 'grid', gap: 20, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it, i) => (
        <div key={it._id ?? i} className="w-loop-item">
          {render(tpl, { ...ctx, record: it })}
        </div>
      ))}
    </div>
  );
}

export function TemplateEmbed({ p, ctx, render }: WidgetProps) {
  const tpl = ctx.templates[String(p.template_id)];
  return tpl ? <>{render(tpl, ctx)}</> : null;
}
