import { mediaSrc, type RenderContext } from '@itti/blocks/layout';
import type { RoutedRecord } from '@/lib/types';

const asUrl = (v: unknown) => (v && typeof v === 'object' && 'url' in v ? String((v as { url: unknown }).url) : typeof v === 'string' ? v : undefined);

/** Student article: title, author, introduction and the article PDF (from the ACF fields). */
export function ArticleView({ record, ctx }: { record: RoutedRecord; ctx: RenderContext }) {
  const f = record.fields ?? {};
  const pdf = mediaSrc(asUrl(f.article_pdf), ctx);
  const image = mediaSrc(asUrl(f.article_image) ?? record.cover?.url, ctx);
  const realPdf = pdf && !pdf.startsWith('data:');
  return (
    <article className="lay article-view">
      <div className="article-hero">
        <div className="article-hero-inner">
          <p className="article-kicker">Student Articles</p>
          <h1>{String(f.article_title ?? record.title)}</h1>
          {f.author ? <p className="article-author">By {String(f.author)}</p> : null}
        </div>
      </div>
      <div className="article-body">
        {image && <img src={image} alt="" className="article-image" />}
        {typeof f.introduction === 'string' && <div className="w-text article-intro" dangerouslySetInnerHTML={{ __html: f.introduction }} />}
        {realPdf ? (
          <div className="itti-pdf-viewer">
            <iframe src={pdf} title={`${record.title} (PDF)`} />
          </div>
        ) : (
          <p className="article-pdf-missing">The full article (PDF) will be available here once the media library is uploaded.</p>
        )}
        {realPdf && (
          <p>
            <a className="w-btn" href={pdf} target="_blank" rel="noopener">
              Read Full Article (PDF)
            </a>
          </p>
        )}
      </div>
    </article>
  );
}
