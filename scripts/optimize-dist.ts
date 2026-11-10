/**
 * `npm run build:small`: a build (`vite build`), then the big photos in dist/assets recompressed so the folder is small enough to share.
 * Every PNG or JPEG over 150 KB is resized to at most 1600px on its longest side (about twice what a 712px cell shows, for a sharp screen) and saved as a
 * JPEG at quality 80; the files that named it (the page, scripts and styles) are rewritten to the new name. A PNG that is not known to be fully opaque is
 * left alone (a cut-out would get a black background as a JPEG). It uses `sips`, which every Mac has, so it does nothing on another system (the build
 * is untouched). `npm run build` is unchanged and keeps the originals.
 *
 *   npm run build:small [-- --max 1600] [-- --quality 80] [-- --min-kb 150]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { formatBytes, isOpaquePng, rewriteNames } from '../lab/lib/dist-optimize.js';

const arg = (name: string, fallback: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) || fallback : fallback;
};
const MAX_SIDE = arg('max', 1600);
const QUALITY = arg('quality', 80);
const MIN_BYTES = arg('min-kb', 150) * 1024;

const dist = join(process.cwd(), 'dist');
if (!existsSync(dist)) { console.error('No dist/ folder: run npm run build:small, or npm run build first.'); process.exit(1); }
if (process.platform !== 'darwin' || spawnSync('sips', ['--help'], { stdio: 'ignore' }).error) {
  console.log('build:small shrinks images with sips, which is only on a Mac: dist/ is left as built.');
  process.exit(0);
}

const folderSize = (dir: string): number => readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? folderSize(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
const before = folderSize(dist);

const assets = join(dist, 'assets');
const renames = new Map<string, string>();
const kept: string[] = [];
for (const file of readdirSync(assets)) {
  const ext = extname(file).toLowerCase();
  const path = join(assets, file);
  if (!['.png', '.jpg', '.jpeg'].includes(ext) || statSync(path).size < MIN_BYTES) continue;
  if (ext === '.png' && !isOpaquePng(readFileSync(path))) { kept.push(file); continue; }
  const out = join(assets, `${basename(file, ext)}.jpg`);
  const tmp = `${out}.tmp.jpg`;
  const res = spawnSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITY), '-Z', String(MAX_SIDE), path, '--out', tmp], { stdio: 'ignore' });
  if (res.status !== 0 || !existsSync(tmp)) { kept.push(file); continue; }
  if (statSync(tmp).size >= statSync(path).size) { unlinkSync(tmp); kept.push(file); continue; } // not smaller: keep the original
  writeFileSync(out, readFileSync(tmp));
  unlinkSync(tmp);
  if (out !== path) { unlinkSync(path); renames.set(file, basename(out)); }
}

// Everything that names a renamed file: the page, the scripts, the styles.
const textFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? textFiles(join(dir, e.name)) : ['.html', '.js', '.css', '.json', '.svg'].includes(extname(e.name)) ? [join(dir, e.name)] : []);
if (renames.size) for (const f of textFiles(dist)) {
  const text = readFileSync(f, 'utf8');
  const next = rewriteNames(text, renames);
  if (next !== text) writeFileSync(f, next);
}

const after = folderSize(dist);
console.log(`build:small: ${renames.size} image${renames.size === 1 ? '' : 's'} recompressed (JPEG ${QUALITY}, at most ${MAX_SIDE}px): dist ${formatBytes(before)} → ${formatBytes(after)}`);
if (kept.length) console.log(`left as they were (not known to be opaque, or no smaller): ${kept.join(', ')}`);
