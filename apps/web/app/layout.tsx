import '@fortawesome/fontawesome-free/css/all.min.css';
import '@itti/blocks/layout.css';
import './globals.css';
import { ImageFallbacks, PopupHost, tokensCss } from '@itti/blocks/layout';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { HosthausMark } from '@/components/site/HosthausMark';
import { fontsHref, makeContext, prepare, Region } from '@/lib/render';
import { getSettings, getTemplate, MEDIA_BASE, SITE_URL } from '@/lib/site';
import { mediaSrc } from '@itti/blocks/layout';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const icon = mediaSrc(s.favicon, { mediaBase: MEDIA_BASE });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: s.siteName, template: `%s - ${s.siteName}` },
    description: s.description ?? s.tagline,
    icons: icon && !icon.startsWith('data:') ? { icon } : undefined,
    openGraph: { siteName: s.siteName, type: 'website', locale: 'en_GH' },
  };
}

/**
 * Site chrome rendered from the theme templates (header, footer, floating chat,
 * popups) stored in the CMS, exactly as designed on the original site.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await getSettings();
  const [header, footer, floating, ...popups] = await Promise.all([
    getTemplate(s.theme?.header),
    getTemplate(s.theme?.footer),
    getTemplate(s.theme?.floating),
    ...(s.theme?.popups ?? []).map((p) => getTemplate(p.slug)),
  ]);
  const ctx = await makeContext('');
  await Promise.all([prepare(header?.layout, ctx), prepare(footer?.layout, ctx)]);
  const fonts = fontsHref(s.tokens?.fonts);

  return (
    <html lang="en-US">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {fonts && <link rel="stylesheet" href={fonts} />}
        {s.tokens && <style dangerouslySetInnerHTML={{ __html: tokensCss(s.tokens) }} />}
      </head>
      <body>
        <Region nodes={header?.layout} ctx={ctx} as="header" className="site-header" />
        <main id="content">{children}</main>
        <Region nodes={footer?.layout} ctx={ctx} as="footer" className="site-footer" />
        <div className="site-watermark">
          <span aria-hidden />
          {s.watermark?.enabled !== false ? (
            <HosthausMark label={s.watermark?.label ?? 'Built by HostHaus'} url={s.watermark?.url ?? 'https://hosthaus.com'} />
          ) : (
            <span />
          )}
          {/* Discreet entry to the admin portal (ittighana.com/staff) */}
          <a href="/staff/login" rel="nofollow" className="staff-login">
            Staff login
          </a>
        </div>
        <Region nodes={floating?.layout} ctx={ctx} className="site-floating" />
        <ImageFallbacks />
        <PopupHost
          popups={popups.filter(Boolean).map((p, i) => ({
            id: String(s.theme!.popups[i]!.id),
            content: <Region nodes={p!.layout} ctx={ctx} />,
          }))}
        />
      </body>
    </html>
  );
}
