import type { MediaRef } from '@itti/schemas';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Card({ href, image, title, meta, children }: { href: string; image?: MediaRef; title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <Link href={href} className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="aspect-[16/10] overflow-hidden bg-gray-100">
        {image && <img src={image.url} alt={image.alt} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {meta && <div className="mb-2 text-sm font-medium text-brand-blue">{meta}</div>}
        <h3 className="text-lg font-semibold text-brand-ink group-hover:text-brand">{title}</h3>
        {children && <div className="mt-2 text-gray-700">{children}</div>}
      </div>
    </Link>
  );
}

export const Grid = ({ children }: { children: ReactNode }) => (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
);

export const Container = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);
