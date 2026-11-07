import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The lab's tab icon is the 🧪 emoji: an SVG, a PNG for Safari and a touch icon, all linked from the page (relative, so a built copy works too).
const root = process.cwd();
describe('the lab\'s favicon', () => {
  it('has the files', () => {
    for (const f of ['favicon.svg', 'favicon.png', 'apple-touch-icon.png']) expect(statSync(join(root, 'lab/public', f)).size, f).toBeGreaterThan(100);
    expect(readFileSync(join(root, 'lab/public/favicon.svg'), 'utf8')).toContain('🧪');
  });
  it('is linked from the page, with relative paths', () => {
    const html = readFileSync(join(root, 'lab/index.html'), 'utf8');
    for (const href of ['./favicon.svg', './favicon.png', './apple-touch-icon.png']) expect(html, href).toContain(`href="${href}"`);
    expect(existsSync(join(root, 'lab/public'))).toBe(true);
  });
});
