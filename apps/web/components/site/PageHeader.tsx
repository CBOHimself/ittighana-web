import type { MediaRef } from '@itti/schemas';
import Link from 'next/link';

type Crumb = { label: string; href?: string };

export function PageHeader({ title, intro, image, crumbs = [] }: { title: string; intro?: string; image?: MediaRef; crumbs?: Crumb[] }) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-ink py-16 text-white sm:py-20">
      {image && <img src={image.url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-white/70">
            <Link href="/" className="hover:text-white">Home</Link>
            {crumbs.map((c) => (
              <span key={c.label}>
                {' / '}
                {c.href ? <Link href={c.href} className="hover:text-white">{c.label}</Link> : <span className="text-white">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-4xl font-bold sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-white/80">{intro}</p>}
      </div>
    </section>
  );
}
