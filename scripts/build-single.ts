/**
 * `npm run build:single -- --base <folder with the old index.html and pages/> [--out export/jane-street-motion-vN] [--page homepage]`
 *
 * One standalone HTML file per page version, to sit beside the pages of an earlier packaged index (the "jane-street-motion" folder). Each file is the
 * lab's own preview mode for that version (the lab's own motion, not a copy): script, styles, markup, and only the images and fonts that version
 * actually loads are embedded, so it opens from disk with no server. A bootstrap keeps the view in memory (a file:// page can't change its address),
 * Esc and the logo go back to ../index.html like the older pages, and the arrow keys and the preview bar are switched off.
 *
 * Versions of this round are shown as R2 V1, R2 V2 … (--round), and the older rows already in the index become R1 V1 … (--old-round).
 * Reads the page versions as they are on disk right now. Builds to a scratch folder, never to dist/.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { chromium } from '@playwright/test';
import { isOpaquePng, rewriteNames } from '../lab/lib/dist-optimize.js';

const arg = (name: string, fallback = ''): string => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] ?? fallback : fallback; };
const BASE = arg('base');
const OUT = arg('out', 'export/jane-street-motion-v5');
const PAGE = arg('page', 'homepage');
const ROUND = arg('round', '2'); // this round: its versions are shown as R2 V1, R2 V2 …
const OLD_ROUND = arg('old-round', '1'); // the rows already in the index (Homepage, V1) are relabelled R1 V1
// lab version id → the number it is shown as (in order, from FIRST_NAME)
// 'v11=2' shows lab version v11 as V2; a plain id takes its place in the list
const IDS = (arg('versions', 'v1,v11,v12,v13,v14,v15')).split(',');
if (!BASE || !existsSync(join(BASE, 'index.html'))) { console.error('Give --base <folder that has index.html and pages/>.'); process.exit(1); }

const root = process.cwd();
const scratch = join(tmpdir(), `a17-single-${Date.now()}`);
const built = join(scratch, 'build');
mkdirSync(scratch, { recursive: true });

// 1. Build.
const b = spawnSync('npx', ['vite', 'build', '--outDir', built, '--emptyOutDir'], { cwd: root, stdio: 'ignore' });
if (b.status !== 0) { console.error('The build failed.'); process.exit(1); }
const assets = join(built, 'assets');

// 2. Shrink the big photos (a Mac's sips), the way build:small does.
const renames = new Map<string, string>();
for (const file of readdirSync(assets)) {
  const ext = extname(file).toLowerCase();
  const path = join(assets, file);
  if (!['.png', '.jpg', '.jpeg'].includes(ext) || statSync(path).size < 150 * 1024) continue;
  if (ext === '.png' && !isOpaquePng(readFileSync(path))) continue;
  const out = join(assets, `${basename(file, ext)}.jpg`);
  const tmp = `${out}.tmp.jpg`;
  const r = spawnSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', '1600', path, '--out', tmp], { stdio: 'ignore' });
  if (r.status !== 0 || !existsSync(tmp)) continue;
  if (statSync(tmp).size >= statSync(path).size) { unlinkSync(tmp); continue; }
  writeFileSync(out, readFileSync(tmp)); unlinkSync(tmp);
  if (out !== path) { unlinkSync(path); renames.set(file, basename(out)); }
}
const jsName = readdirSync(assets).find(f => /^index-.*\.js$/.test(f))!;
const cssName = readdirSync(assets).find(f => /^index-.*\.css$/.test(f))!;
let js = readFileSync(join(assets, jsName), 'utf8');
let css = readFileSync(join(assets, cssName), 'utf8');
js = rewriteNames(js, renames);
css = rewriteNames(css, renames);
// The page reads its view from the address; a file:// page can't change it, so the bootstrap keeps the query in memory.
js = js.split('window.location.search').join('window.__JSM_Q()');

// 3. A small static server, to see which files each version really loads.
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.otf': 'font/otf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0]!);
  const f = join(built, p === '/' ? 'index.html' : p);
  if (!f.startsWith(built) || !existsSync(f) || statSync(f).isDirectory()) { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', MIME[extname(f)] ?? 'application/octet-stream');
  res.end(readFileSync(f));
});
await new Promise<void>(r => server.listen(0, r));
const port = (server.address() as { port: number }).port;

const html0 = readFileSync(join(built, 'index.html'), 'utf8');
const backScript = [...readFileSync(join(BASE, 'pages', readdirSync(join(BASE, 'pages'))[0]!), 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]!).find(s => s.includes('data-jsm-back'));
if (!backScript) { console.error('Could not find the old pages\' back-to-index script.'); process.exit(1); }

const browser = await chromium.launch();
const outPages = join(OUT, 'jane-street-motion', 'pages');
rmSync(OUT, { recursive: true, force: true });
cpSync(BASE, join(OUT, 'jane-street-motion'), { recursive: true });
const rows: { href: string; label: string }[] = [];

const dataUri = (name: string): string => `data:${MIME[extname(name)] ?? 'application/octet-stream'};base64,${readFileSync(join(assets, name)).toString('base64')}`;

for (const [i, entry] of IDS.entries()) {
  const [id, num] = entry.split('=') as [string, string | undefined];
  const n = num ?? String(i + 1); // a number or a label such as 1.1
  const query = `?view=page&page=${PAGE}&pv=${id}&preview=1`;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const used = new Set<string>();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/assets/') && !/index-.*\.(js|css)$/.test(u.pathname)) used.add(basename(u.pathname)); });
  await page.goto(`http://localhost:${port}/index.html${query}`);
  await page.waitForTimeout(2500);
  for (let y = 0; y < 12; y++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(250); }
  await page.waitForTimeout(1500);
  const title = await page.evaluate(() => document.title);
  await ctx.close();
  if (errors.length) console.warn(`  ${id}: page errors: ${errors.join(' | ')}`);

  // Embed what this version loaded.
  const table: Record<string, string> = {};
  let vjs = js, vcss = css;
  for (const name of used) {
    const uri = dataUri(name);
    if (vjs.includes(`new URL("${name}",import.meta.url)`)) { table[name] = uri; vjs = vjs.split(`new URL("${name}",import.meta.url)`).join(`new URL(__JSM[${JSON.stringify(name)}])`); }
    vcss = vcss.split(`url(./${name})`).join(`url(${uri})`);
  }
  vcss = vcss.replace(/url\(\.\/[^)]*\)/g, 'url(data:,)'); // fonts this version never loads
  const safe = (s: string): string => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  const bootstrap = `(function(){var q=${JSON.stringify(query)};window.__JSM_Q=function(){return q};
function set(u){try{q=new URL(u,"http://x/").search}catch(e){}}
var nf=window.fetch;window.fetch=function(u){return typeof u==="string"&&u.indexOf("/__lab/")>-1?Promise.reject(new Error("dev server only")):nf.apply(this,arguments)};
history.pushState=history.replaceState=function(a,b,u){if(u!=null)set(u)};
function back(){if(window.parent!==window){parent.postMessage({jsmIndex:1},"*")}else{location.href="../index.html"}}
addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest('.logo-mark,[aria-label="Jane Street"]')){e.preventDefault();e.stopPropagation();back()}},true);
addEventListener("keydown",function(e){if(e.key==="Escape"||e.key==="ArrowLeft"||e.key==="ArrowRight"){e.stopImmediatePropagation();e.preventDefault();if(e.key==="Escape")back()}},true);
})();`;
  let html = html0
    .replace(/<script type="module"[^>]*><\/script>/, '')
    .replace(/<link rel="stylesheet"[^>]*>/, '')
    .replace(/<link rel="(icon|apple-touch-icon)"[^>]*>/g, '')
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title.replace(/</g, '&lt;')}</title>`);
  const head = `<style>${vcss}</style><style>#lab-preview-bar{display:none!important}</style><script>var __JSM=${JSON.stringify(table)};</script><script>${safe(bootstrap)}</script>`;
  const tail = `<script>${safe(backScript)}</script><script type="module">${safe(vjs)}</script>`;
  html = html.replace('</head>', () => `${head}</head>`).replace('</body>', () => `${tail}</body>`); // functions, so $ in the code is not read as a pattern
  const file = `${PAGE}-r${ROUND}-v${n.replace('.', '-')}.html`;
  mkdirSync(outPages, { recursive: true });
  writeFileSync(join(outPages, file), html);
  rows.push({ href: `pages/${file}`, label: `${PAGE[0]!.toUpperCase()}${PAGE.slice(1)}, R${ROUND} V${n}` });
  console.log(`  ${id} → ${file}: ${(html.length / 1048576).toFixed(1)} MB, ${used.size} files embedded`);
}
await browser.close();
server.close();

// 4. Index: sections for the older round and this one.
const idxPath = join(OUT, 'jane-street-motion', 'index.html');
let idx = readFileSync(idxPath, 'utf8');
idx = idx.replace(/(<span>[^<]*?), V(\d+)(<\/span>)/g, (_m, a, v, z) => `${a}, R${OLD_ROUND} V${v}${z}`); // older rows: Homepage, V1 → Homepage, R1 V1
const rowRe = new RegExp(`<li><a href="pages/${PAGE}-v\\d+\\.html">[\\s\\S]*?</li>`, 'g');
const existing = [...idx.matchAll(rowRe)];
const last = existing.at(-1);
if (!last) { console.error('No existing row to copy in the index.'); process.exit(1); }
const make = (r: { href: string; label: string }): string => last[0].replace(/href="[^"]*"/, `href="${r.href}"`).replace(/<span>[^<]*<\/span>/, `<span>${r.label}</span>`);
// Two sections: every row already there is Round ${OLD_ROUND}, the new pages are Round ${ROUND}.
const ul = /<ul>([\s\S]*?)<\/ul>/.exec(idx);
if (!ul) { console.error('No list in the index.'); process.exit(1); }
idx = idx.replace(ul[0], () => `<h2>Round ${OLD_ROUND}</h2>\n  <ul>${ul[1]}</ul>\n  <h2>Round ${ROUND}</h2>\n  <ul>\n    ${rows.map(make).join('\n    ')}\n  </ul>`);
idx = idx.replace('</style>', () => 'h2{font-size:12px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:44px 0 12px}h1+h2{margin-top:0}\n</style>');
writeFileSync(idxPath, idx);

rmSync(scratch, { recursive: true, force: true });
void copyFileSync;
console.log(`Written to ${OUT}`);
