/**
 * The dev server's /__lab/scale endpoint: what the Tokens view's Apply button talks to.
 *   GET   → { available: true }                      (the button looks for this: a built copy has none)
 *   POST  { scale, dryRun? } → what changed          (applies the scale to every kind, as `--all` does)
 *
 * Dev server only, never part of `npm run build`. It writes only tokens/motion.json and the version
 * files, through the same runScale the command line uses, and refuses a request that comes from
 * another site's page (an Origin that isn't this server's own).
 */
import type { Plugin } from 'vite';
import { SCALE_KINDS } from '../lab/lib/scale-apply.js';
import { scaleDef } from '../lab/lib/scales.js';
import { runScale } from './scale-run.js';

export interface ScaleRequest {
  method: string;
  /** The Origin header, when the browser sent one. */
  origin?: string | undefined;
  /** The Host header: this server. */
  host?: string | undefined;
  body?: string;
}

export interface ScaleResponse { status: number; body: unknown }

export const SCALE_ENDPOINT = '/__lab/scale';

export function handleScaleRequest(root: string, req: ScaleRequest): ScaleResponse {
  if (req.origin && req.host) {
    let originHost = '';
    try { originHost = new URL(req.origin).host; } catch { /* a bad Origin is refused below */ }
    if (originHost !== req.host) return { status: 403, body: { error: 'Refused: this request did not come from the lab.' } };
  }
  if (req.method === 'GET') return { status: 200, body: { available: true } };
  if (req.method !== 'POST') return { status: 405, body: { error: 'Use GET or POST.' } };

  let input: { scale?: unknown; dryRun?: unknown };
  try {
    input = JSON.parse(req.body || '{}') as typeof input;
  } catch {
    return { status: 400, body: { error: 'The request is not valid JSON.' } };
  }
  if (typeof input.scale !== 'string') return { status: 400, body: { error: 'Say which scale to apply.' } };
  try {
    scaleDef(input.scale);
    const run = runScale({ root, kinds: [...SCALE_KINDS], scale: input.scale, dryRun: input.dryRun === true });
    return {
      status: 200,
      body: {
        scale: run.scale,
        dryRun: run.dryRun,
        renamed: Object.entries(run.renames).filter(([from, to]) => from !== to).length,
        versionFiles: run.versionFiles,
      },
    };
  } catch (e) {
    return { status: 400, body: { error: (e as Error).message } };
  }
}

export function scaleApplyPlugin(root: string): Plugin {
  return {
    name: 'motion-lab-scale-apply',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(SCALE_ENDPOINT, (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const out = handleScaleRequest(root, {
            method: req.method ?? 'GET',
            origin: req.headers.origin,
            host: req.headers.host,
            body: Buffer.concat(chunks).toString('utf8'),
          });
          res.statusCode = out.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(out.body));
        });
      });
    },
  };
}
