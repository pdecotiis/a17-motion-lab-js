// Records the opening of homepage page versions as 1440x900 videos: node scripts/record-videos.mjs [--url http://motionlab.localhost:5400] [--seconds 9] v11 v12 …
// Each version is opened in preview mode at 1440x900 (the page at its own size), played from its first frame and recorded with Chromium's own recorder (webm), then trimmed to start with the intro and
// converted to mp4 (H.264) with ffmpeg. Output: export/videos/<name>.mp4. Needs the dev server (or any served copy) and ffmpeg.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; args.splice(i, 2); return v; };
const base = opt('--url', 'http://motionlab.localhost:5400');
const seconds = Number(opt('--seconds', '9'));
const page_ = opt('--page', 'homepage');
const names = JSON.parse(opt('--names', '{}'));   // { "v11": "R2 V1.1" }
const versions = args.length ? args : ['v11', 'v12', 'v13', 'v14'];
mkdirSync('export/videos', { recursive: true });
const tmp = 'export/videos/.tmp';
rmSync(tmp, { recursive: true, force: true });

// mp4 (H.264) with the computer's ffmpeg when it works; otherwise webm (VP9) with the ffmpeg that comes with Playwright (it has no H.264)
function playwrightFfmpeg() {
  const root = join(homedir(), 'Library/Caches/ms-playwright');
  const dir = readdirSync(root).filter(d => d.startsWith('ffmpeg-')).sort().pop();
  return dir ? join(root, dir, readdirSync(join(root, dir)).find(f => f.startsWith('ffmpeg-'))) : null;
}
function encode(webm, offset, stem) {
  const common = ['-y', '-loglevel', 'error', '-ss', offset.toFixed(2), '-i', webm, '-t', String(seconds), '-r', '30'];
  try {
    execFileSync('ffmpeg', [...common, '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${stem}.mp4`], { stdio: 'pipe' });
    return `${stem}.mp4`;
  } catch { /* no working system ffmpeg: fall back */ }
  const ff = playwrightFfmpeg();
  if (!ff) throw new Error('No ffmpeg that can encode video was found');
  execFileSync(ff, [...common, '-c:v', 'libvpx-vp9', '-crf', '22', '-b:v', '0', '-pix_fmt', 'yuv420p', `${stem}.webm`], { stdio: 'pipe' });
  return `${stem}.webm`;
}

const browser = await chromium.launch();
for (const v of versions) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, recordVideo: { dir: tmp, size: { width: 1440, height: 900 } } });
  // the preview bar (the name and the keys) shows for four seconds when preview opens: not in a video
  await context.addInitScript(() => { const st = document.createElement('style'); st.textContent = '.lab-preview-bar { display: none !important; }'; document.documentElement.appendChild(st); });
  const page = await context.newPage();
  const created = Date.now();
  await page.goto(`${base}/?view=page&page=${page_}&pv=${v}&preview=1`, { waitUntil: 'load' });
  await page.waitForSelector('.lab-page-grid');
  await page.waitForFunction(() => document.getAnimations().length > 0, null, { timeout: 15000 });
  // when the intro starts, on the video's clock: the page's own start (its time origin) plus the first animation's start
  const startedAt = await page.evaluate(() => performance.timeOrigin + Math.min(...document.getAnimations().map(a => Number(a.startTime ?? Infinity)).filter(Number.isFinite)));
  const offset = Math.max(0, (startedAt - created) / 1000);
  await page.waitForTimeout(seconds * 1000);
  const video = page.video();
  await context.close();
  const webm = await video.path();
  const stem = `export/videos/${page_}${names[v] ? `-${names[v].replace(/\s+/g, '-')}` : ''}-${v}`;
  const out = encode(webm, offset, stem);
  console.log(`${v}: ${out} (started ${offset.toFixed(2)}s into the recording)`);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
