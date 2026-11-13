/**
 * The dev server's /__lab/archive endpoint: what the Archive buttons for a whole component, a whole page and a page's versions talk to.
 *   GET   → { available: true }                                          (a built copy has none)
 *   POST  { kind: 'component', component, archived } → { archived: boolean }       (components/<name>/archived.json)
 *   POST  { kind: 'page', page, archived }           → { archived: boolean }       (pages/<id>/archived.json)
 *   POST  { kind: 'page-version', page, version, archived } → { archived: [ids] }  (pages/<id>/archived.json)
 * Dev server only, never part of `npm run build`. One small file per request; refuses a request from another site's page.
 */
import type { Plugin } from 'vite';
import { setComponentArchived, setPageArchived, setPageVersionArchived } from './archive-save.js';

export const ARCHIVE_ENDPOINT = '/__lab/archive';

export interface ArchiveRequest { method: string; origin?: string | undefined; host?: string | undefined; body?: string }
export interface ArchiveResponse { status: number; body: unknown }

export function handleArchiveRequest(root: string, req: ArchiveRequest): ArchiveResponse {
  if (req.origin && req.host) {
    let originHost = '';
    try { originHost = new URL(req.origin).host; } catch { /* a bad Origin is refused below */ }
    if (originHost !== req.host) return { status: 403, body: { error: 'Refused: this request did not come from the lab.' } };
  }
  if (req.method === 'GET') return { status: 200, body: { available: true } };
  if (req.method !== 'POST') return { status: 405, body: { error: 'Use GET or POST.' } };
  let input: Record<string, unknown>;
  try { input = JSON.parse(req.body || '{}') as Record<string, unknown>; } catch { return { status: 400, body: { error: 'The request is not valid JSON.' } }; }
  const { kind, component, page, version, archived } = input;
  if (typeof archived !== 'boolean') return { status: 400, body: { error: 'Say whether to archive or unarchive.' } };
  try {
    if (kind === 'component' && typeof component === 'string') return { status: 200, body: { archived: setComponentArchived(root, { component, archived }) } };
    if (kind === 'page' && typeof page === 'string') return { status: 200, body: { archived: setPageArchived(root, { page, archived }) } };
    if (kind === 'page-version' && typeof page === 'string' && typeof version === 'string') {
      return { status: 200, body: { archived: setPageVersionArchived(root, { page, version, archived }) } };
    }
    return { status: 400, body: { error: 'Say what to archive: a component, a page, or a page version.' } };
  } catch (e) {
    return { status: 400, body: { error: (e as Error).message } };
  }
}

export function archivePlugin(root: string): Plugin {
  return {
    name: 'motion-lab-archive',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ARCHIVE_ENDPOINT, (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const out = handleArchiveRequest(root, { method: req.method ?? 'GET', origin: req.headers.origin, host: req.headers.host, body: Buffer.concat(chunks).toString('utf8') });
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
