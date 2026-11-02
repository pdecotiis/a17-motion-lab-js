import { describe, it, expect } from 'vitest';
import { summarizeInteraction } from '../../lab/lib/interaction-summary.js';
import { describeTransition } from '../../lab/lib/interaction.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
import { v2 as panelV2 } from '../../components/side-panel/versions/v2.js';
import { v2 as cardV2 } from '../../components/card/versions/v2.js';
import { v1 as cardV1 } from '../../components/card/versions/v1.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('summarizeInteraction', () => {
  it('says nothing for a version with no interaction', () => {
    expect(summarizeInteraction(cardV1, raw, 'css').lines).toEqual([]);
  });

  it('describes card hover and press in plain words, layers included, under CSS', () => {
    const s = summarizeInteraction(cardV2, raw, 'css', { component: 'card' });
    const hover = s.lines.find(l => l.heading === 'Hover')!;
    expect(hover.text).toContain('When you hover over the card');
    expect(hover.text).toContain('the card moves up 4px (220ms, productive standard)');
    expect(hover.text).toContain('the image scales to 103% (300ms');
    expect(hover.text).toContain('Moving off goes back to rest');
    const press = s.lines.find(l => l.heading === 'Press')!;
    expect(press.text).toContain('scales to 98%');
    expect(s.fromOutside).toEqual([]);
  });

  it('describes timing as duration and bounce under Motion', () => {
    const s = summarizeInteraction(cardV2, raw, 'motion', { component: 'card' });
    expect(s.text).toMatch(/220ms, bounce/);
    expect(s.text).not.toContain('productive standard');
  });

  it('lists states nothing inside the component leads to', () => {
    const s = summarizeInteraction(panelV2, raw, 'css', { component: 'side-panel' });
    expect(s.fromOutside).toEqual(['open']);
    expect(s.lines.find(l => l.heading === 'Click')!.text).toContain('it goes to closed');
    expect(s.lines.find(l => l.heading === 'Open')!.text).toContain('something outside does');
  });
});

describe('describeTransition with a layer target', () => {
  it('names the layer and uses its own timing', () => {
    const text = describeTransition(cardV2.interaction!, 'hover', raw, 'css', { target: 'image' });
    expect(text).toBe('image into hover: Easing · productive-standard, 300ms');
  });
});
