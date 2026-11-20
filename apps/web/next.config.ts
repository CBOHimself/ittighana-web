import type { NextConfig } from 'next';
import path from 'node:path';

/**
 * Media keeps its original WordPress paths (/wp-content/uploads/…) so every
 * imported URL keeps working. They're proxied to the media host:
 *   production → https://media.ittighana.com (cPanel folder)
 *   development → the API's local /media folder
 */
const mediaOrigin = (process.env.MEDIA_ORIGIN ?? `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/media`).replace(/\/$/, '');

const config: NextConfig = {
  // Self-contained server bundle for cPanel (Passenger runs .next/standalone/apps/web/server.js)
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  transpilePackages: ['@itti/blocks', '@itti/schemas'],
  poweredByHeader: false,
  images: { unoptimized: true },
  async rewrites() {
    const adminDev = process.env.ADMIN_DEV_URL?.replace(/\/$/, '');
    return {
      beforeFiles: [
        { source: '/wp-content/uploads/:path*', destination: `${mediaOrigin}/wp-content/uploads/:path*` },
        // Development: proxy the admin portal's Vite server (ADMIN_DEV_URL=http://localhost:5176)
        ...(adminDev ? [{ source: '/staff/:path*', destination: `${adminDev}/staff/:path*` }] : []),
      ],
      // Production: the admin build lives in public/staff. Real files (assets) are served
      // first; any other /staff route loads its index.html. afterFiles runs before the
      // site's catch-all page route, so /staff never reaches the CMS page resolver.
      afterFiles: [
        { source: '/staff', destination: '/staff/index.html' },
        { source: '/staff/:path*', destination: '/staff/index.html' },
      ],
      fallback: [],
    };
  },
  async headers() {
    // The staff portal is private: never indexed, never framed, no stale index.html.
    const staff = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [
      { source: '/staff', headers: [...staff, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/staff/:path((?!assets/).*)', headers: [...staff, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/staff/assets/:path*', headers: [...staff, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
  async redirects() {
    return [
      { source: '/wp-admin/:path*', destination: '/', permanent: true },
      { source: '/feed', destination: '/', permanent: true },
      { source: '/home', destination: '/', permanent: true },
    ];
  },
};

export default config;
