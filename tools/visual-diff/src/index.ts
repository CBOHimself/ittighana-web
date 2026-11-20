/**
 * Screenshot every URL on the old WordPress site and the new site at three
 * widths, then write a pixel-diff report so we can prove the content and design match.
 *
 *   OLD_BASE=https://www.ittighana.com NEW_BASE=https://staging.ittighana.com pnpm visual-diff
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const OLD = (process.env.OLD_BASE ?? 'https://www.ittighana.com').replace(/\/$/, '');
const NEW = (process.env.NEW_BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const WIDTHS = [1440, 768, 390];
const out = path.join(import.meta.dirname, '..', 'output');

const urls = (await readFile(path.join(import.meta.dirname, '..', 'urls.txt'), 'utf8'))
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const browser = await chromium.launch();
const rows: string[] = [];

for (const url of urls) {
  for (const width of WIDTHS) {
    const shots: PNG[] = [];
    for (const base of [OLD, NEW]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(base + url, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.addStyleTag({ content: '*{animation:none!important;transition:none!important} [data-watermark],.cf-turnstile{visibility:hidden!important}' });
      shots.push(PNG.sync.read(await page.screenshot({ fullPage: true })));
      await page.close();
    }
    const [a, b] = shots as [PNG, PNG];
    const w = Math.max(a.width, b.width);
    const h = Math.max(a.height, b.height);
    const pad = (img: PNG) => {
      const p = new PNG({ width: w, height: h });
      PNG.bitblt(img, p, 0, 0, img.width, img.height, 0, 0);
      return p;
    };
    const pa = pad(a);
    const pb = pad(b);
    const diff = new PNG({ width: w, height: h });
    const changed = pixelmatch(pa.data, pb.data, diff.data, w, h, { threshold: 0.15 });
    const pct = ((changed / (w * h)) * 100).toFixed(2);
    const name = `${url.replace(/\W+/g, '_') || 'home'}_${width}`;
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, `${name}.old.png`), PNG.sync.write(pa));
    await writeFile(path.join(out, `${name}.new.png`), PNG.sync.write(pb));
    await writeFile(path.join(out, `${name}.diff.png`), PNG.sync.write(diff));
    rows.push(`<tr><td>${url}</td><td>${width}</td><td>${pct}%</td><td><a href="${name}.old.png">old</a> · <a href="${name}.new.png">new</a> · <a href="${name}.diff.png">diff</a></td></tr>`);
    console.log(`${url} @${width}px → ${pct}% different`);
  }
}

await browser.close();
await writeFile(
  path.join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>ITTI visual diff</title><style>body{font-family:sans-serif;padding:24px}td,th{padding:6px 12px;border-bottom:1px solid #eee}</style><h1>Old vs new</h1><table><tr><th>URL</th><th>Width</th><th>Diff</th><th>Images</th></tr>${rows.join('')}</table>`,
);
console.log(`Report → ${path.join(out, 'index.html')}`);
