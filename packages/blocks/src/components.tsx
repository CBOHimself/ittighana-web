import type { BlockOf, MediaRef } from '@itti/schemas';
import type { ReactNode } from 'react';

/**
 * Framework-agnostic block components (plain <img>/<a>), styled with Tailwind
 * utility classes and the brand tokens defined in apps/web/app/globals.css.
 * Used by the website and by the admin live preview.
 */

const Img = ({ m, className, sizes }: { m: MediaRef; className?: string; sizes?: string }) => (
  <img src={m.url} alt={m.alt} width={m.width} height={m.height} loading="lazy" className={className} sizes={sizes} />
);

const Section = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 ${className}`}>{children}</section>
);

const Html = ({ html, className = '' }: { html: string; className?: string }) => (
  // HTML is sanitised by the API before it is stored.
  <div
    className={`prose prose-lg max-w-none prose-p:text-gray-800 prose-li:text-gray-800 prose-headings:text-brand prose-a:text-brand-blue hover:prose-a:text-brand-blue-dark ${className}`}
    dangerouslySetInnerHTML={{ __html: html }}
  />
);

type ButtonVariant = 'primary' | 'blue' | 'secondary' | 'light';
const Button = ({ href, children, variant = 'primary' }: { href: string; children: ReactNode; variant?: ButtonVariant }) => {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    /* ITTI "Text" blue: the primary action on navy backgrounds */
    blue: 'bg-brand-blue text-white hover:bg-brand-blue-dark',
    secondary: 'bg-accent text-brand-ink hover:opacity-90',
    light: 'bg-white text-brand hover:bg-white/90',
  }[variant];
  return (
    <a href={href} className={`inline-flex items-center rounded-md px-6 py-3 font-semibold transition ${styles}`}>
      {children}
    </a>
  );
};

export function Hero(b: BlockOf<'hero'>) {
  return (
    <section className="relative isolate flex min-h-[60vh] items-center overflow-hidden bg-brand-ink text-white">
      {b.image && <Img m={b.image} className="absolute inset-0 -z-10 h-full w-full object-cover" />}
      {b.overlay && <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-ink/90 to-brand-ink/40" />}
      <div className={`mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8 ${b.align === 'center' ? 'text-center' : ''}`}>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl" style={b.align === 'center' ? { marginInline: 'auto' } : undefined}>
          {b.heading}
        </h1>
        {b.subheading && <p className="mt-6 max-w-2xl text-lg text-white/85" style={b.align === 'center' ? { marginInline: 'auto' } : undefined}>{b.subheading}</p>}
        {(b.primaryCta || b.secondaryCta) && (
          <div className={`mt-10 flex flex-wrap gap-4 ${b.align === 'center' ? 'justify-center' : ''}`}>
            {b.primaryCta && <Button href={b.primaryCta.href} variant="blue">{b.primaryCta.label}</Button>}
            {b.secondaryCta && <Button href={b.secondaryCta.href} variant="light">{b.secondaryCta.label}</Button>}
          </div>
        )}
      </div>
    </section>
  );
}

export const RichText = (b: BlockOf<'richText'>) => (
  <Section>
    <Html html={b.html} />
  </Section>
);

export const ImageBlock = (b: BlockOf<'image'>) => {
  const img = <Img m={b.image} className="w-full rounded-lg" />;
  return (
    <Section>
      <figure>
        {b.href ? <a href={b.href}>{img}</a> : img}
        {b.caption && <figcaption className="mt-2 text-sm text-gray-700">{b.caption}</figcaption>}
      </figure>
    </Section>
  );
};

export const ImageGallery = (b: BlockOf<'imageGallery'>) => (
  <Section>
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${Math.floor(1200 / b.columns)}px), 1fr))` }}>
      {b.images.map((m, i) => (
        <a key={i} href={m.url} data-lightbox={b.lightbox ? 'gallery' : undefined} className="group block overflow-hidden rounded-lg">
          <Img m={m} className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
        </a>
      ))}
    </div>
  </Section>
);

export const TwoColumn = (b: BlockOf<'twoColumn'>) => (
  <Section>
    <div className={`grid items-center gap-10 lg:grid-cols-2 ${b.imagePosition === 'left' ? 'lg:[&>*:first-child]:order-2' : ''}`}>
      <div>
        {b.heading && <h2 className="mb-6 text-3xl font-bold text-brand-ink">{b.heading}</h2>}
        <Html html={b.html} />
        {b.cta && <div className="mt-8"><Button href={b.cta.href}>{b.cta.label}</Button></div>}
      </div>
      {b.image && <Img m={b.image} className="w-full rounded-xl object-cover shadow-lg" />}
    </div>
  </Section>
);

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
  5: 'sm:grid-cols-3 lg:grid-cols-5',
  6: 'sm:grid-cols-3 lg:grid-cols-6',
};

export const FeatureGrid = (b: BlockOf<'featureGrid'>) => (
  <Section>
    {b.heading && <h2 className="mb-10 text-center text-3xl font-bold text-brand-ink">{b.heading}</h2>}
    <div className={`grid gap-6 ${GRID_COLS[b.columns] ?? GRID_COLS[3]}`}>
      {b.items.map((it, i) => {
        const inner = (
          <div className="h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            {it.image && <Img m={it.image} className="mb-4 aspect-video w-full rounded-lg object-cover" />}
            <h3 className="text-xl font-semibold text-brand-ink">{it.title}</h3>
            {it.text && <p className="mt-2 text-gray-700">{it.text}</p>}
          </div>
        );
        return it.href ? <a key={i} href={it.href}>{inner}</a> : <div key={i}>{inner}</div>;
      })}
    </div>
  </Section>
);

export const Stats = (b: BlockOf<'stats'>) => (
  <section className="bg-brand text-white">
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-center sm:grid-cols-2 lg:grid-cols-4">
      {b.items.map((s, i) => (
        <div key={i}>
          <div className="text-4xl font-bold">{s.value}</div>
          <div className="mt-1 text-white/80">{s.label}</div>
        </div>
      ))}
    </div>
  </section>
);

export const Testimonial = (b: BlockOf<'testimonial'>) => (
  <Section>
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {b.items.map((t, i) => (
        <blockquote key={i} className="rounded-xl bg-gray-50 p-6">
          <p className="text-gray-700">“{t.quote}”</p>
          <footer className="mt-4 flex items-center gap-3">
            {t.photo && <Img m={t.photo} className="h-10 w-10 rounded-full object-cover" />}
            <div>
              <div className="font-semibold text-brand-ink">{t.name}</div>
              {t.role && <div className="text-sm text-gray-700">{t.role}</div>}
            </div>
          </footer>
        </blockquote>
      ))}
    </div>
  </Section>
);

export const Faq = (b: BlockOf<'faq'>) => (
  <Section className="max-w-3xl">
    {b.heading && <h2 className="mb-8 text-3xl font-bold text-brand-ink">{b.heading}</h2>}
    <div className="divide-y divide-gray-200 rounded-xl border border-gray-200">
      {b.items.map((f, i) => (
        <details key={i} className="group p-5">
          <summary className="cursor-pointer list-none font-semibold text-brand-ink">{f.question}</summary>
          <Html html={f.answer} className="prose-base mt-3" />
        </details>
      ))}
    </div>
  </Section>
);

export const Cta = (b: BlockOf<'cta'>) => {
  const bg = { primary: 'bg-brand text-white', secondary: 'bg-accent text-brand-ink', dark: 'bg-brand-ink text-white' }[b.variant];
  return (
    <section className={bg}>
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-3xl font-bold">{b.heading}</h2>
        {b.text && <p className="mx-auto mt-4 max-w-2xl opacity-90">{b.text}</p>}
        <div className="mt-8"><Button href={b.button.href} variant={b.variant === 'secondary' ? 'primary' : 'blue'}>{b.button.label}</Button></div>
      </div>
    </section>
  );
};

function embedUrl(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

export const Video = (b: BlockOf<'video'>) => (
  <Section className="max-w-5xl">
    <div className="aspect-video overflow-hidden rounded-xl">
      <iframe src={embedUrl(b.url)} title={b.title ?? 'Video'} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
    </div>
  </Section>
);

export const Downloads = (b: BlockOf<'downloads'>) => (
  <Section className="max-w-3xl">
    {b.heading && <h2 className="mb-6 text-2xl font-bold text-brand-ink">{b.heading}</h2>}
    <ul className="space-y-3">
      {b.files.map((f, i) => (
        <li key={i}>
          <a href={f.url} className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:border-brand" download>
            <span className="font-medium">{f.label}</span>
            <span className="text-sm text-brand">Download ↓</span>
          </a>
        </li>
      ))}
    </ul>
  </Section>
);

export const ApplyButton = (b: BlockOf<'applyButton'> & { defaultFormHref?: string }) => {
  const href = b.formSlug ? `/enroll/${b.formSlug}` : b.defaultFormHref;
  if (!href) return null;
  return (
    <Section className="text-center">
      <Button href={href}>{b.label}</Button>
    </Section>
  );
};

export const Spacer = (b: BlockOf<'spacer'>) => <div className={{ sm: 'h-6', md: 'h-12', lg: 'h-20', xl: 'h-32' }[b.size]} aria-hidden />;
