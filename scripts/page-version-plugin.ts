/**
 * The dev server's /__lab/page-version endpoint: what the Page view's "Save as new version" talks to.
 *   GET   → { available: true }                                     (a built copy has none)
 *   POST  { page, label, motionMap, stagger?, forkedFrom? } → { id } (writes pages/<page>/versions/v<n>.json)
 *   POST  { page, overwrite: 'v3', motionMap, stagger? }     → { id } (saves over that saved version: its name and lineage stay)
 *
 * Dev server only, never part of `npm run build`. It writes only that one version file (a new one, or the one named to save over) and refuses a
 * request that comes from another site's page (an Origin that isn't this server's own).
 */
import type { Plugin } from 'vite';
import { savePageVersion } from './page-version-save.js';

export interface PageVersionRequest {
  method: string;
  /** The Origin header, when the browser sent one. */
  origin?: string | undefined;
  /** The Host header: this server. */
  host?: string | undefined;
  body?: string;
}

export interface PageVersionResponse { status: number; body: unknown }

export const PAGE_VERSION_ENDPOINT = '/__lab/page-version';

export function handlePageVersionRequest(root: string, req: PageVersionRequest): PageVersionResponse {
  if (req.origin && req.host) {
    let originHost = '';
    try { originHost = new URL(req.origin).host; } catch { /* a bad Origin is refused below */ }
    if (originHost !== req.host) return { status: 403, body: { error: 'Refused: this request did not come from the lab.' } };
  }
  if (req.method === 'GET') return { status: 200, body: { available: true } };
  if (req.method !== 'POST') return { status: 405, body: { error: 'Use GET or POST.' } };

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(req.body || '{}') as Record<string, unknown>;
  } catch {
    return { status: 400, body: { error: 'The request is not valid JSON.' } };
  }
  const { page, label, motionMap, stagger, forkedFrom, overwrite } = input;
  if (typeof page !== 'string' || (typeof label !== 'string' && typeof overwrite !== 'string')) return { status: 400, body: { error: 'Say which page and what to call the version.' } };
  if (typeof motionMap !== 'object' || motionMap === null || Array.isArray(motionMap)) return { status: 400, body: { error: 'Send the version of each component.' } };
  try {
    const saved = savePageVersion(root, {
      page,
      label: typeof label === 'string' ? label : undefined,
      overwrite: typeof overwrite === 'string' ? overwrite : undefined,
      motionMap: motionMap as Record<string, string>,
      stagger: typeof stagger === 'string' ? stagger : undefined,
      forkedFrom: typeof forkedFrom === 'string' ? forkedFrom : undefined,
    });
    return { status: 200, body: { id: saved.id } };
  } catch (e) {
    return { status: 400, body: { error: (e as Error).message } };
  }
}

export function pageVersionPlugin(root: string): Plugin {
  return {
    name: 'motion-lab-page-version',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(PAGE_VERSION_ENDPOINT, (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const out = handlePageVersionRequest(root, {
            method: req.method ?? 'GET',
            origin: req.headers.origin,
            host: req.headers.host,
            body: Buffer.concat(chunks).toString('utf8'),
          });
          // The new file is outside the lab's root, so the server does not see it arrive: forget what it knew of the version files
          // (they are read with a glob) so the page that reloads next finds the new version.
          if (out.status === 200 && req.method === 'POST') server.moduleGraph.invalidateAll();
          res.statusCode = out.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(out.body));
        });
      });
    },
  };
}
