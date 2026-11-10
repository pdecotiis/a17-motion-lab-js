/**
 * The dev server's /__lab/version-archive endpoint: what the component view's Archive and Unarchive buttons talk to.
 *   GET   → { available: true }                                   (a built copy has none)
 *   POST  { component, version, archived } → { archived: [ids] }  (writes components/<component>/archived.json)
 *
 * Dev server only, never part of `npm run build`. It writes only that one small file and refuses a request that comes from another
 * site's page (an Origin that isn't this server's own).
 */
import type { Plugin } from 'vite';
import { setVersionArchived } from './version-archive-save.js';

export const VERSION_ARCHIVE_ENDPOINT = '/__lab/version-archive';

export interface VersionArchiveRequest {
  method: string;
  origin?: string | undefined;
  host?: string | undefined;
  body?: string;
}
export interface VersionArchiveResponse { status: number; body: unknown }

export function handleVersionArchiveRequest(root: string, req: VersionArchiveRequest): VersionArchiveResponse {
  if (req.origin && req.host) {
    let originHost = '';
    try { originHost = new URL(req.origin).host; } catch { /* a bad Origin is refused below */ }
    if (originHost !== req.host) return { status: 403, body: { error: 'Refused: this request did not come from the lab.' } };
  }
  if (req.method === 'GET') return { status: 200, body: { available: true } };
  if (req.method !== 'POST') return { status: 405, body: { error: 'Use GET or POST.' } };
  let input: Record<string, unknown>;
  try { input = JSON.parse(req.body || '{}') as Record<string, unknown>; } catch { return { status: 400, body: { error: 'The request is not valid JSON.' } }; }
  const { component, version, archived } = input;
  if (typeof component !== 'string' || typeof version !== 'string' || typeof archived !== 'boolean') {
    return { status: 400, body: { error: 'Say which component and version, and whether to archive it.' } };
  }
  try {
    return { status: 200, body: { archived: setVersionArchived(root, { component, version, archived }) } };
  } catch (e) {
    return { status: 400, body: { error: (e as Error).message } };
  }
}

export function versionArchivePlugin(root: string): Plugin {
  return {
    name: 'motion-lab-version-archive',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(VERSION_ARCHIVE_ENDPOINT, (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const out = handleVersionArchiveRequest(root, { method: req.method ?? 'GET', origin: req.headers.origin, host: req.headers.host, body: Buffer.concat(chunks).toString('utf8') });
          // The file may be new and is outside the lab's root: forget what the server knew of the archived lists (read with a glob).
          if (out.status === 200 && req.method === 'POST') server.moduleGraph.invalidateAll();
          res.statusCode = out.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(out.body));
        });
      });
    },
  };
}
