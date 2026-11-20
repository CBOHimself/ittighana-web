import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { ArticleView } from '@/components/site/ArticleView';
import { apiOrNull } from '@/lib/api';
import { makeContext, prepare, Region, toRecordContext } from '@/lib/render';
import type { Resolved } from '@/lib/types';

type Props = { params: Promise<{ slug?: string[] }> };

const pathOf = (slug?: string[]) => '/' + (slug ?? []).map(decodeURIComponent).join('/');
const resolve = (path: string) => apiOrNull<Resolved>('/resolve', { query: { path }, tags: ['content'] });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolve(pathOf((await params).slug));
  if (!r || r.kind === 'redirect') return {};
  const rec = r.record;
  return {
    title: rec.path === '/' ? { absolute: rec.seo?.title ?? 'Home - International Travel and Tourism Institute' } : (rec.seo?.title ?? rec.title),
    description: rec.seo?.description ?? rec.excerpt,
    alternates: { canonical: rec.path ?? undefined },
  };
}

/**
 * Every public URL of the original site, resolved through the API:
 * pages, courses (/itti-course/…), news posts, student articles, events (/events/…)
 * and career openings (/careers/…).
 */
export default async function RoutedPage({ params }: Props) {
  const path = pathOf((await params).slug);
  const r = await resolve(path);
  if (!r) notFound();
  if (r.kind === 'redirect') {
    if (r.code === 301) permanentRedirect(r.to);
    redirect(r.to);
  }

  const ctx = await makeContext(path, toRecordContext(r.kind, r.record));

  if (r.kind === 'page') {
    if (!r.record.layout?.length && r.record.html) {
      return <div className="lay page-html" dangerouslySetInnerHTML={{ __html: r.record.html }} />;
    }
    await prepare(r.record.layout, ctx);
    // The default WordPress page template (Hello theme) prints the page title above
    // the Elementor content; on the original site it sits under the overlapping header.
    const showTitle = (r.record.pageTemplate ?? 'default') === 'default';
    return (
      <>
        {showTitle && (
          <div className="page-header">
            <h1 className="entry-title">{r.record.title}</h1>
          </div>
        )}
        <Region nodes={r.record.layout} ctx={ctx} />
      </>
    );
  }

  // Student articles without a template (none registered) keep the simple article view.
  if (r.kind === 'article' && !r.template?.layout?.length) return <ArticleView record={r.record} ctx={ctx} />;

  // Courses, news, events, student articles and careers render through their content
  // template; the record's own layout (if any) shows where the template places "post content".
  const nodes = r.template?.layout?.length ? r.template.layout : r.record.layout;
  await prepare(nodes, ctx);
  return <Region nodes={nodes} ctx={ctx} />;
}
