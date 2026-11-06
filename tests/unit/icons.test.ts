import { describe, it, expect } from 'vitest';
import { ICONS } from '../../lab/lib/icons.js';

describe('icons', () => {
  it.each(Object.entries(ICONS))('%s is a 20px line icon that takes the button\'s colour and is hidden from screen readers', (_name, markup) => {
    expect(markup).toMatch(/^<svg /);
    expect(markup).toContain('viewBox="0 0 20 20"');
    expect(markup).toContain('stroke="currentColor"');
    expect(markup).toContain('fill="none"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
  it('has the four the header and Settings use', () => {
    expect(Object.keys(ICONS).sort()).toEqual(['close', 'moon', 'settings', 'sun']);
  });
});
