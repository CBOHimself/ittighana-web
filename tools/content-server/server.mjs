/**
 * Content preview server: serves content/<site>/ JSON over the same public
 * endpoints as the real API (/v1/settings, /v1/resolve, /v1/templates, /v1/list)
 * plus /media files, so the website can be previewed without MongoDB.
 *
 *   node tools/content-server/server.mjs --content content/itti --media storage/media --port 4000
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: a } = parseArgs({ options: { content: { type: 'string', default: 'content/itti' }, media: { type: 'string', default: 'storage/media' }, port: { type: 'string', default: '4000' } } });
const DIR = path.resolve(a.content);
const MEDIA = path.resolve(a.media);
const readAll = (sub) => (existsSync(path.join(DIR, sub)) ? readdirSync(path.join(DIR, sub)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(path.join(DIR, sub, f), 'utf8'))) : []);

const site = JSON.parse(readFileSync(path.join(DIR, 'site.json'), 'utf8'));
const templates = readAll('templates');
const lists = { page: readAll('pages'), course: readAll('courses'), news: readAll('news'), article: readAll('articles') };
const published = (x) => x.status === 'published' && x.path;
const settings = {
  siteName: site.name, description: site.description, logo: site.logo, favicon: site.favicon, tokens: site.tokens, menus: site.menus, theme: site.theme,
  whatsapp: { enabled: false, number: '', message: '' }, contact: { phones: [], notifyEmails: [] }, socials: {}, nav: { header: [], footer: [] },
  watermark: { enabled: true, label: 'Built by HostHaus', url: 'https://hosthaus.com' },
};
const tpl = (slug) => templates.find((t) => t.slug === slug && t.status === 'published') ?? null;
// Same rule as the API: the record's own template (for its content type) → the type's default → a legacy theme template.
const contentTpl = (type, picked, legacy) =>
  (picked && templates.find((t) => t.slug === picked && t.contentType === type && t.status === 'published')) ||
  templates.find((t) => t.contentType === type && t.isDefault && t.status === 'published') ||
  tpl(legacy);
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

const send = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    if (p.startsWith('/media/')) {
      const file = path.join(MEDIA, decodeURIComponent(p.slice(7)));
      if (!file.startsWith(MEDIA) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, { error: 'Not found' });
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'public, max-age=3600' });
      return createReadStream(file).pipe(res);
    }
    if (p === '/health') return send(res, 200, { ok: true, mode: 'content-preview' });
    if (p === '/v1/settings') return send(res, 200, settings);
    if (p === '/v1/resolve') {
      const want = (u.searchParams.get('path') || '/').replace(/\/+$/, '') || '/';
      const page = lists.page.find((x) => published(x) && x.path === want);
      if (page) return send(res, 200, { kind: 'page', record: page });
      const course = lists.course.find((x) => published(x) && x.path === want);
      if (course) return send(res, 200, { kind: 'course', record: course, template: contentTpl('course', course.template ?? course.layoutTemplate, site.theme.defaultCourseTemplate) });
      const news = lists.news.find((x) => published(x) && x.path === want);
      if (news) return send(res, 200, { kind: 'news', record: news, template: contentTpl('news', news.template, site.theme.singlePost) });
      const article = lists.article.find((x) => published(x) && x.path === want);
      if (article) return send(res, 200, { kind: 'article', record: article, template: contentTpl('article', article.template) || null });
      return send(res, 404, { error: 'Page not found' });
    }
    let m = p.match(/^\/v1\/templates\/wp\/(\d+)$/);
    if (m) {
      const t = templates.find((x) => String(x.wpId) === m[1]);
      return t ? send(res, 200, t) : send(res, 404, { error: 'Template not found' });
    }
    m = p.match(/^\/v1\/templates\/([^/]+)$/);
    if (m) {
      const t = tpl(m[1]);
      return t ? send(res, 200, t) : send(res, 404, { error: 'Template not found' });
    }
    m = p.match(/^\/v1\/list\/([^/]+)$/);
    if (m) {
      const type = { post: 'news', 'itti-course': 'course', 'student-article': 'article' }[m[1]] ?? m[1];
      const exclude = (u.searchParams.get('exclude') || '').split(',').filter(Boolean);
      const limit = Number(u.searchParams.get('limit') || 10);
      const items = (lists[type] ?? [])
        .filter((x) => published(x) && !exclude.includes(x.path))
        .sort((x, y) => (y.publishedAt ?? '').localeCompare(x.publishedAt ?? ''))
        .slice(0, limit);
      return send(res, 200, items);
    }
    if (req.method === 'POST') return send(res, 201, { ok: true, message: 'Preview mode: submission not stored.' });
    send(res, 404, { error: 'Not found' });
  })
  .listen(Number(a.port), () => console.log(`Content preview API on http://localhost:${a.port} (content: ${DIR})`));
