import { makeContext, prepare, Region } from '@/lib/render';
import { getSettings, getTemplate } from '@/lib/site';

/** 404: rendered from the site's "404 Page" template when it exists. */
export default async function NotFound() {
  const s = await getSettings();
  const t = await getTemplate(s.theme?.notFound);
  const ctx = await makeContext('/404', { kind: 'page', title: 'Page not found' });
  if (t?.layout?.length) {
    await prepare(t.layout, ctx);
    return <Region nodes={t.layout} ctx={ctx} />;
  }
  return (
    <div className="lay" style={{ maxWidth: 640, margin: '0 auto', padding: '120px 20px', textAlign: 'center' }}>
      <h1 className="w-title" style={{ fontSize: 40 }}>Page not found</h1>
      <p className="w-text" style={{ marginTop: 16 }}>The page you are looking for may have moved.</p>
      <p style={{ marginTop: 32 }}>
        <a className="w-btn" href="/" style={{ background: 'var(--e-global-color-primary)' }}>Back to home</a>
      </p>
    </div>
  );
}
