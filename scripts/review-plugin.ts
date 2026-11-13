/**
 * The dev server's /__lab/review endpoint: what the Ready for review button talks to.
 *   GET   → { available: true }                                   (a built copy has none)
 *   POST  { page, version, ready } → { marked: [ids] }            (pages/<id>/review.json)
 * Dev server only, never part of `npm run build`. One small file per request; refuses a request from another site's page.
 */
import type { Plugin } from 'vite';
import { setPageVersionReview } from './review-save.js';

export const REVIEW_ENDPOINT = '/__lab/review';

export interface ReviewRequest { method: string; origin?: string | undefined; host?: string | undefined; body?: string }
export interface ReviewResponse { status: number; body: unknown }

export function handleReviewRequest(root: string, req: ReviewRequest): ReviewResponse {
  if (req.origin && req.host) {
    let originHost = '';
    try { originHost = new URL(req.origin).host; } catch { /* a bad Origin is refused below */ }
    if (originHost !== req.host) return { status: 403, body: { error: 'Refused: this request did not come from the lab.' } };
  }
  if (req.method === 'GET') return { status: 200, body: { available: true } };
  if (req.method !== 'POST') return { status: 405, body: { error: 'Use GET or POST.' } };
  let input: Record<string, unknown>;
  try { input = JSON.parse(req.body || '{}') as Record<string, unknown>; } catch { return { status: 400, body: { error: 'The request is not valid JSON.' } }; }
  const { page, version, ready } = input;
  if (typeof page !== 'string' || typeof version !== 'string' || typeof ready !== 'boolean') return { status: 400, body: { error: 'Say which page version, and whether it is ready.' } };
  try { return { status: 200, body: { marked: setPageVersionReview(root, { page, version, ready }) } }; } catch (e) { return { status: 400, body: { error: (e as Error).message } }; }
}

export function reviewPlugin(root: string): Plugin {
  return {
    name: 'motion-lab-review',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(REVIEW_ENDPOINT, (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const out = handleReviewRequest(root, { method: req.method ?? 'GET', origin: req.headers.origin, host: req.headers.host, body: Buffer.concat(chunks).toString('utf8') });
          // The file may be new and is outside the lab's root: forget what the server knew of the review lists (read with a glob).
          if (out.status === 200 && req.method === 'POST') server.moduleGraph.invalidateAll();
          res.statusCode = out.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(out.body));
        });
      });
    },
  };
}
