import { describe, it, expect } from 'vitest';
import { summarizeInteraction } from '../../lab/lib/interaction-summary.js';
import { describeTransition } from '../../lab/lib/interaction.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, MotionVersion } from '../../lab/lib/types.js';
import { v2 as panelV2 } from '../../components/side-panel/versions/v2.js';
import { v2 as cardV2 } from '../../components/card/versions/v2.js';
import { v1 as cardV1 } from '../../components/card/versions/v1.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

// Card v2 has an entrance and states but no interaction layer; layers are covered on a fixture built from it.
const withImage: MotionVersion = {
  ...cardV2,
  interaction: {
    ...cardV2.interaction!,
    layers: {
      image: {
        states: { hovered: { transform: 'scale(1.03)' }, pressed: { transform: 'scale(1.03)' } },
        transitions: { hovered: { model: 'tween', duration: 'duration.250', easing: 'easing.productive-standard' } },
      },
    },
  },
};

describe('summarizeInteraction', () => {
  it('says nothing for a version with no interaction', () => {
    expect(summarizeInteraction(cardV1, raw, 'css').lines).toEqual([]);
  });

  it('describes card hover and press in plain words, layers included, under CSS', () => {
    const s = summarizeInteraction(withImage, raw, 'css', { component: 'card' });
    const hover = s.lines.find(l => l.heading === 'Hover')!;
    expect(hover.text).toContain('When you hover over the card');
    expect(hover.text).toContain('the card moves up 4px (200ms, productive standard)');
    expect(hover.text).toContain('the image scales to 103% (250ms');
    expect(hover.text).toContain('Moving off goes back to default');
    const press = s.lines.find(l => l.heading === 'Press')!;
    expect(press.text).toContain('scales to 95%');
    expect(s.fromOutside).toEqual([]);
  });

  it('describes timing as duration and bounce under Motion', () => {
    const s = summarizeInteraction(cardV2, raw, 'motion', { component: 'card' });
    expect(s.text).toMatch(/200ms, bounce/);
    expect(s.text).not.toContain('productive standard');
  });

  it('lists states nothing inside the component leads to', () => {
    const s = summarizeInteraction(panelV2, raw, 'css', { component: 'side-panel' });
    expect(s.fromOutside).toEqual(['open']);
    expect(s.lines.find(l => l.heading === 'Click')!.text).toContain('it goes to closed');
    expect(s.lines.find(l => l.heading === 'Open')!.text).toContain('something outside does');
  });
});

describe('a version that appears, then has states (card v2)', () => {
  it('says how it appears first, then hover and press', () => {
    const s = summarizeInteraction(cardV2, raw, 'css', { component: 'card' });
    expect(s.lines.map(l => l.heading)).toEqual(['Appears', 'Hover', 'Press']);
    const appears = s.lines[0]!.text;
    expect(appears).toContain('the card fades in and rises 20px (200ms, productive entrance)');
    expect(appears).toContain('the title fades in and rises 8px');
    expect(appears).toContain('the text fades in and rises 8px');
    expect(appears).toContain('Hover, press and focus work once it has appeared');
    expect(s.lines[1]!.text).toContain('the card moves up 4px');
    expect(s.lines[1]!.text).not.toContain('image');
    expect(s.fromOutside).toEqual([]);
  });
  it('a version with no entrance has no Appears line', () => {
    expect(summarizeInteraction(panelV2, raw, 'css', { component: 'side-panel' }).lines.map(l => l.heading)).not.toContain('Appears');
  });
  it('under Motion the entrance is in duration and bounce', () => {
    expect(summarizeInteraction(cardV2, raw, 'motion', { component: 'card' }).lines[0]!.text).toMatch(/200ms, bounce/);
  });
});

describe('describeTransition with a layer target', () => {
  it('names the layer and uses its own timing', () => {
    const text = describeTransition(withImage.interaction!, 'hovered', raw, 'css', { target: 'image' });
    expect(text).toBe('image into hovered: Easing · productive-standard, 250ms');
  });
});
