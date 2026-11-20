import { connectDb, disconnectDb } from '../connection';
import { Page, SiteSettings } from '../models';

/**
 * Minimal seed so a fresh database renders. Real content comes from
 * tools/wp-migrate (the WordPress import).
 */
await connectDb();

await SiteSettings.updateOne(
  { key: 'site' },
  {
    $setOnInsert: {
      key: 'site',
      value: {
        siteName: 'ITTI Ghana',
        whatsapp: { enabled: true, number: '', message: 'Hello ITTI, I would like to make an enquiry.' },
        contact: { phones: [], notifyEmails: [] },
        socials: {},
        nav: {
          header: [
            { label: 'Home', href: '/' },
            { label: 'About', href: '/about' },
            { label: 'Courses', href: '/courses' },
            {
              label: 'Campus',
              href: '/campus',
              children: [
                { label: 'Gallery', href: '/campus/gallery' },
                { label: 'Student Articles', href: '/campus/articles' },
                { label: 'Spaces', href: '/campus/spaces' },
              ],
            },
            { label: 'Careers', href: '/careers' },
            { label: 'Events', href: '/events' },
            { label: 'Contact', href: '/contact' },
          ],
          footer: [],
        },
        watermark: { enabled: true, label: 'Built by HostHaus', url: 'https://hosthaus.com' },
      },
    },
  },
  { upsert: true },
);

for (const p of [
  { slug: 'home', title: 'Home', template: 'home' },
  { slug: 'about', title: 'About', template: 'about' },
]) {
  await Page.updateOne(
    { slug: p.slug },
    { $setOnInsert: { ...p, blocks: [], seo: {}, status: 'published' } },
    { upsert: true },
  );
}

console.log('✓ Seed complete');
await disconnectDb();
