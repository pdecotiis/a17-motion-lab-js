import { describe, it, expect, vi } from 'vitest';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import {
  validateInteraction, resolveState, stateProps, stateNames, stateRefs, transitionInto,
  cssTransitionPlan, motionStates, motionTransitionPlan, describeTransition,
  layerNames, partProps, partValues, timingFor, interactionParts, TRIGGER_EVENTS, NATURAL_VALUES,
} from '../../lab/lib/interaction.js';
import { transformParts, TRANSFORM_IDENTITY } from '../../lab/lib/transform.js';
import { validateMotionVersion, modelOf, stepsOf } from '../../lab/lib/motion-models.js';
import { pairingWarnings, getStepRefs, getTokenRefs } from '../../lab/lib/token-refs.js';
import { buildVersionCss } from '../../lab/lib/css-output.js';
import { buildVersionExport } from '../../lab/lib/spec.js';
import { buildGsapCode, buildMotionCode } from '../../lab/lib/export-code.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, Interaction, MotionVersion } from '../../lab/lib/types.js';
import { v2 } from '../../components/side-panel/versions/v2.js';
import { versions as panelVersions } from '../../components/side-panel/motion.js';

const tokens = compileTokens(tokensJson as unknown as DtcgGroup);
const { raw } = tokens;
gsap.registerPlugin(CustomEase);

const interaction = v2.interaction!;
const version = (over: Partial<Interaction> = {}): MotionVersion => ({ ...v2, interaction: { ...interaction, ...over } });

describe('the side panel Open / Close version', () => {
  it('is a version with two states: closed (where it rests) and open', () => {
    expect(stateNames(interaction)).toEqual(['closed', 'open']);
    expect(interaction.initial).toBe('closed');
    expect(stateProps(interaction)).toEqual(['opacity', 'transform']);
  });

  it('validates, follows the pairing rules, and sits in the component\'s versions', () => {
    expect(() => validateMotionVersion(v2)).not.toThrow();
    expect(pairingWarnings(v2, raw)).toEqual([]);
    expect(panelVersions.map(v => v.id)).toContain('v2');
    expect(v2.forkedFrom).toBe('v1');
  });

  it('names a transition into every state: a bouncy spring in, a plain exit out', () => {
    expect(transitionInto(interaction, 'open')).toMatchObject({ model: 'spring', easing: 'easing.expressive-entrance', bounce: 'bounce.50' });
    expect(transitionInto(interaction, 'closed')).toMatchObject({ model: 'spring', easing: 'easing.productive-exit', bounce: 'bounce.0' });
    expect(() => transitionInto(interaction, 'lost')).toThrow('No transition into state "lost"');
  });
});

describe('validateInteraction', () => {
  it('accepts a version with no interaction, and the real one', () => {
    expect(() => validateInteraction({ ...v2, interaction: undefined })).not.toThrow();
    expect(() => validateInteraction(v2)).not.toThrow();
  });

  it('needs two or more states, one of them the initial one', () => {
    expect(() => validateInteraction(version({ states: { closed: {} }, transitions: { closed: interaction.transitions['closed']! } }))).toThrow('at least two states');
    expect(() => validateInteraction(version({ initial: 'lost' }))).toThrow('starts in "lost"');
  });

  it('needs a transition into every state, and none into a state that does not exist', () => {
    expect(() => validateInteraction(version({ transitions: { open: interaction.transitions['open']! } }))).toThrow('no transition into state "closed"');
    expect(() => validateInteraction(version({ transitions: { ...interaction.transitions, lost: interaction.transitions['open']! } }))).toThrow('"lost", which is not one of its states');
  });

  it('keeps to motion properties, and a transition needs a duration and an easing', () => {
    expect(() => validateInteraction(version({ states: { ...interaction.states, open: { display: 'block' } } }))).toThrow('structural property: "display"');
    expect(() => validateInteraction(version({ transitions: { ...interaction.transitions, open: { model: 'tween', duration: 'duration.300' } as never } }))).toThrow('needs a duration and an easing');
  });

  it('checks a spring bounce: a token or a number from 0 to 1', () => {
    const bad = version({ transitions: { ...interaction.transitions, open: { model: 'spring', duration: 'duration.300', easing: 'easing.productive-entrance', bounce: 2 } } });
    expect(() => validateInteraction(bad)).toThrow('bounce must be a bounce token or a number from 0 to 1');
  });
});

describe('a version with an interaction needs no model', () => {
  it('v2 names none, and validates', () => {
    expect(v2.model).toBeUndefined();
    expect(() => validateMotionVersion(v2)).not.toThrow();
  });

  it('modelOf derives the timing of its first transition, as a tween', () => {
    expect(modelOf(v2)).toEqual({ model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance' });
  });

  it('the root of stepsOf carries that model, so every panel that expects one has it', () => {
    expect(stepsOf(v2)[0]!.version.model).toEqual(modelOf(v2));
    expect(stepsOf(v2)).toHaveLength(1);
  });

  it('keeps its own model when it names one; a version with neither is refused', () => {
    const own = { ...v2, model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance' } } as MotionVersion;
    expect(modelOf(own)).toMatchObject({ duration: 'duration.300' });
    const none = { id: 'x', label: 'x' } as MotionVersion;
    expect(() => validateMotionVersion(none)).toThrow('needs a model, an entrance preset, or an interaction');
    expect(() => modelOf(none)).toThrow('has no model and no interaction');
  });
});

describe('triggers', () => {
  const withTriggers = (triggers: Interaction['triggers']): MotionVersion => version({ triggers });

  it('the side panel\'s v2 declares a click on the close layer that sets closed', () => {
    expect(v2.interaction!.triggers).toEqual([{ on: 'click', target: 'close', set: 'closed' }]);
  });

  it('the events are hover, press, focus and click', () => {
    expect(TRIGGER_EVENTS).toEqual(['hover', 'press', 'focus', 'click']);
  });

  it('accepts hover, press and focus (to a state other than rest), and a click that sets or toggles', () => {
    expect(() => validateInteraction(withTriggers([
      { on: 'hover', state: 'open' }, { on: 'press', state: 'open', target: 'title' }, { on: 'focus', state: 'open', target: 'close' },
      { on: 'click', set: 'open', target: 'list' }, { on: 'click', toggle: ['closed', 'open'] },
    ]))).not.toThrow();
    expect(() => validateInteraction(withTriggers(undefined))).not.toThrow();
    expect(() => validateInteraction(withTriggers([]))).not.toThrow();
  });

  it('refuses an unknown event, a state that does not exist, and a bad target name', () => {
    expect(() => validateInteraction(withTriggers([{ on: 'swipe', state: 'open' } as never]))).toThrow('unknown trigger "swipe" (use hover, press, focus, click)');
    expect(() => validateInteraction(withTriggers([{ on: 'hover', state: 'lost' }]))).toThrow('hover trigger goes to "lost", which is not one of its states (closed, open)');
    expect(() => validateInteraction(withTriggers([{ on: 'click', set: 'lost' }]))).toThrow('click trigger sets "lost"');
    expect(() => validateInteraction(withTriggers([{ on: 'hover', state: 'open', target: 'Page Title' }]))).toThrow('must be lowercase letters, numbers and hyphens, as in data-motion="Page Title"');
  });

  it('hover, press and focus cannot go to the resting state: they return to it when they end', () => {
    expect(() => validateInteraction(withTriggers([{ on: 'hover', state: 'closed' }]))).toThrow('goes to "closed", the resting state');
  });

  it('a click needs either a state to set or two different states to toggle', () => {
    expect(() => validateInteraction(withTriggers([{ on: 'click' } as never]))).toThrow('either "set" (a state) or "toggle"');
    expect(() => validateInteraction(withTriggers([{ on: 'click', set: 'open', toggle: ['closed', 'open'] } as never]))).toThrow('either "set" (a state) or "toggle"');
    expect(() => validateInteraction(withTriggers([{ on: 'click', toggle: ['open', 'open'] }]))).toThrow('two different states');
    expect(() => validateInteraction(withTriggers([{ on: 'click', toggle: ['open', 'lost'] }]))).toThrow('toggles "lost"');
  });

  it('refuses two triggers for the same event on the same element', () => {
    expect(() => validateInteraction(withTriggers([{ on: 'hover', state: 'open' }, { on: 'hover', state: 'open' }]))).toThrow('two hover triggers on the component');
    expect(() => validateInteraction(withTriggers([{ on: 'click', set: 'open', target: 'close' }, { on: 'click', set: 'closed', target: 'close' }]))).toThrow('two click triggers on "close"');
    expect(() => validateInteraction(withTriggers([{ on: 'click', set: 'open', target: 'close' }, { on: 'click', set: 'open' }]))).not.toThrow();
  });
});

describe('layers of an interaction', () => {
  const layered = (layers: Interaction['layers']): MotionVersion => version({ layers });
  const imageHover: Interaction['layers'] = { image: { states: { open: { transform: 'scale({scale.103})' } }, transitions: { open: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance' } } } };

  it('accepts values and their own timing for the states', () => {
    expect(() => validateInteraction(layered(imageHover))).not.toThrow();
    expect(layerNames(layered(imageHover).interaction!)).toEqual(['image']);
    expect(interactionParts(layered(imageHover).interaction!)).toEqual([null, 'image']);
  });

  it('refuses a bad name, values for a state that does not exist, structural properties and a bad timing', () => {
    expect(() => validateInteraction(layered({ 'Hero Image': { states: {} } }))).toThrow('interaction layer name "Hero Image"');
    expect(() => validateInteraction(layered({ image: { states: { lost: { opacity: 1 } } } }))).toThrow('layer "image" has values for "lost"');
    expect(() => validateInteraction(layered({ image: { states: { open: { width: '10px' } } } }))).toThrow('layer "image" state "open" contains structural property: "width"');
    expect(() => validateInteraction(layered({ image: { states: {}, transitions: { lost: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance' } } } }))).toThrow('layer "image" has a transition into "lost"');
    expect(() => validateInteraction(layered({ image: { states: {}, transitions: { open: { model: 'tween', duration: 'duration.300' } as never } } }))).toThrow('needs a duration and an easing');
  });

  it('partProps lists what a part changes: the root\'s, and a layer\'s', () => {
    const i = layered(imageHover).interaction!;
    expect(partProps(i, null)).toEqual(['opacity', 'transform']);
    expect(partProps(i, 'image')).toEqual(['transform']);
    expect(partProps(i, 'nope')).toEqual([]);
  });

  it('partValues fills a property a state leaves out with its natural value', () => {
    const i = layered(imageHover).interaction!;
    expect(partValues(i, 'image', 'open')).toEqual({ transform: 'scale({scale.103})' });
    expect(partValues(i, 'image', 'closed')).toEqual({ transform: 'none' });
    expect(partValues(i, null, 'open')).toEqual({ opacity: 1, transform: 'translateX(0px)' });
    expect(NATURAL_VALUES).toMatchObject({ opacity: 1, transform: 'none' });
  });

  it('a property with no natural value must be given in every state', () => {
    const i = { ...interaction, layers: { image: { states: { open: { color: 'red' } } } } };
    expect(() => partValues(i, 'image', 'closed')).toThrow('leaves out "color", which has no natural value');
  });

  it('timingFor: a layer\'s own timing where it has one, else the component\'s', () => {
    const i = layered(imageHover).interaction!;
    expect(timingFor(i, 'image', 'open')).toMatchObject({ model: 'tween', duration: 'duration.300' });
    expect(timingFor(i, 'image', 'closed')).toBe(interaction.transitions['closed']);
    expect(timingFor(i, null, 'open')).toBe(interaction.transitions['open']);
  });
});

describe('states', () => {
  it('resolves token references in a state\'s values, and lists the tokens it names', () => {
    expect(resolveState(interaction.states['closed']!, raw)).toEqual({ opacity: 0, transform: 'translateX(48px)' });
    expect(stateRefs(interaction.states['closed']!)).toEqual(['distance.48']);
    expect(stateRefs(interaction.states['open']!)).toEqual([]);
  });

  it('puts the resting state first', () => {
    expect(stateNames({ ...interaction, initial: 'open' })).toEqual(['open', 'closed']);
  });
});

describe('transformParts', () => {
  it('splits a transform string into independent properties', () => {
    expect(transformParts('translateX(48px) scale(0.9) rotate(-5deg)').props).toEqual({ x: 48, scale: 0.9, rotate: -5 });
    expect(transformParts('translate(4px, 8px)').props).toEqual({ x: 4, y: 8 });
    expect(transformParts('scale(1, 0.5)').props).toEqual({ scaleX: 1, scaleY: 0.5 });
    expect(transformParts('translateX(100%)').props).toEqual({ x: '100%' });
  });

  it('none is nothing, and what it cannot convert is listed', () => {
    expect(transformParts('none')).toEqual({ props: {}, unsupported: [] });
    expect(transformParts('skewX(10deg)').unsupported).toEqual(['skewX(10deg)']);
    expect(TRANSFORM_IDENTITY).toMatchObject({ x: 0, scale: 1, rotate: 0 });
  });
});

describe('cssTransitionPlan: going to a state in CSS', () => {
  it('animates to the state\'s values over the transition\'s duration, along its easing curve', () => {
    const open = cssTransitionPlan(interaction, 'open', raw);
    expect(open).toMatchObject({ animate: { opacity: 1, transform: 'translateX(0px)' }, snap: {}, duration: 560, delay: 0 });
    expect(open.easing).toBe('cubic-bezier(0, 0, 0.3, 1)');
    const closed = cssTransitionPlan(interaction, 'closed', raw);
    expect(closed).toMatchObject({ animate: { opacity: 0, transform: 'translateX(48px)' }, duration: 300 });
    expect(closed.easing).toBe('cubic-bezier(0.2, 0, 1, 0.9)');
  });

  it('a spring plays its easing in CSS, and says so', () => {
    expect(cssTransitionPlan(interaction, 'open', raw).note).toBe('authored as a spring; CSS plays its easing');
  });

  it('reduced motion keeps the opacity fade (at most 150ms) and snaps the movement', () => {
    const p = cssTransitionPlan(interaction, 'open', raw, { reducedMotion: true });
    expect(p.animate).toEqual({ opacity: 1 });
    expect(p.snap).toEqual({ transform: 'translateX(0px)' });
    expect(p.duration).toBe(150);
  });

  it('reduced motion with the "none" policy animates nothing', () => {
    const p = cssTransitionPlan(interaction, 'open', raw, { reducedMotion: true, reducedPolicy: 'none' });
    expect(p.animate).toEqual({});
    expect(p.snap).toEqual({ opacity: 1, transform: 'translateX(0px)' });
  });
});

describe('motionStates and motionTransitionPlan: going to a state in Motion', () => {
  it('turns transforms into independent properties, the same in every state', () => {
    expect(motionStates(interaction, raw)).toEqual({ closed: { opacity: 0, x: 48 }, open: { opacity: 1, x: 0 } });
  });

  it('a transform property one state leaves out is its resting value there', () => {
    const states = motionStates({ ...interaction, states: { a: { transform: 'scale(0.9)' }, b: { transform: 'translateX(10px)' } } }, raw);
    expect(states).toEqual({ a: { scale: 0.9, x: 0 }, b: { x: 10, scale: 1 } });
  });

  it('a spring: its duration is when it arrives, its bounce is the transition\'s own', () => {
    const open = motionTransitionPlan(interaction, 'open', raw, { globalBounce: 'bounce.0' });
    expect(open.animate).toEqual({ opacity: 1, x: 0 });
    expect(open.options).toEqual({ type: 'spring', visualDuration: 0.56, bounce: 0.5, delay: 0 });
    expect(open.bounceToken).toBe('bounce.50');
    expect(motionTransitionPlan(interaction, 'closed', raw, { globalBounce: 'bounce.50' }).options.bounce).toBe(0);
  });

  it('a tween transition plays as a spring with the global bounce', () => {
    const tween = version({ transitions: { ...interaction.transitions, open: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance' } } });
    const p = motionTransitionPlan(tween.interaction!, 'open', raw, { globalBounce: 'bounce.25' });
    expect(p.options).toMatchObject({ visualDuration: 0.3, bounce: 0.25 });
    expect(p.note).toBe('authored as easing; bounce is the global setting');
  });

  it('reduced motion: an opacity fade with no bounce, movement snaps', () => {
    const p = motionTransitionPlan(interaction, 'open', raw, { reducedMotion: true });
    expect(p.animate).toEqual({ opacity: 1 });
    expect(p.snap).toEqual({ x: 0 });
    expect(p.options).toMatchObject({ visualDuration: 0.15, bounce: 0 });
  });
});

describe('describeTransition', () => {
  it('says what plays into each state, under each runtime', () => {
    expect(describeTransition(interaction, 'open', raw, 'css')).toBe('into open: Easing · expressive-entrance, 560ms (authored as a spring; CSS plays its easing)');
    expect(describeTransition(interaction, 'open', raw, 'motion')).toBe('into open: Spring · bounce 0.5 (bounce.50), 560ms');
    expect(describeTransition(interaction, 'closed', raw, 'motion')).toBe('into closed: Spring · bounce 0 (bounce.0), 300ms');
  });
});

describe('tokens used by an interaction version', () => {
  const uses = (runtime?: 'css' | 'motion') => getStepRefs(v2, raw, runtime, 'bounce.25')[0]!.uses.map(u => `${u.token} [${u.where.join(', ')}]`);

  it('lists each transition\'s duration and easing, and the tokens a state\'s values name', () => {
    expect(uses('css')).toEqual(expect.arrayContaining([
      'duration.560 [into open duration]', 'easing.expressive-entrance [into open easing]',
      'duration.300 [into closed duration]', 'easing.productive-exit [into closed easing]',
      'distance.48 [closed transform]',
    ]));
  });

  it('under Motion no easing is listed, and each transition lists its bounce token', () => {
    const m = uses('motion');
    expect(m).toEqual(expect.arrayContaining(['bounce.50 [into open bounce]', 'bounce.0 [into closed bounce]']));
    expect(m.some(u => u.startsWith('easing.'))).toBe(false);
  });

  it('as authored (what exports) lists the easings and the bounce tokens', () => {
    const t = getTokenRefs(v2, raw).tokens;
    expect(t).toEqual(expect.arrayContaining(['easing.expressive-entrance', 'easing.productive-exit', 'bounce.50', 'bounce.0', 'distance.48']));
  });
});

describe('the CSS export of states', () => {
  const css = buildVersionCss(v2, raw, { component: 'side-panel' });

  it('the rest state is the class, every other state is data-state, each with the timing into it', () => {
    expect(css).toContain('.motion-side-panel-v2 {\n  opacity: 0;\n  transform: translateX(var(--motion-distance-48, 48px));');
    expect(css).toContain('.motion-side-panel-v2[data-state="open"] {\n  opacity: 1;\n  transform: translateX(0px);');
    expect(css).toContain('transition-duration: var(--motion-duration-560, 560ms);');
    expect(css).toContain('transition-duration: var(--motion-duration-300, 300ms);');
    expect(css).toContain('transition-timing-function: var(--motion-easing-expressive-entrance, cubic-bezier(0, 0, 0.3, 1));');
    expect(css).toContain('transition-timing-function: var(--motion-easing-productive-exit, cubic-bezier(0.2, 0, 1, 0.9));');
    expect(css).toContain('transition-property: opacity, transform;');
  });

  it('says how to use it, and that a spring plays its easing in CSS', () => {
    expect(css).toContain('sets data-state="<state>" on the element');
    expect(css).toContain('authored as a spring; CSS plays its easing');
  });

  it('under reduced motion the opacity still fades briefly and the movement snaps', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s+\.motion-side-panel-v2,\s+\.motion-side-panel-v2\[data-state="open"\] \{\s+transition-property: opacity;\s+transition-duration: 150ms;/);
  });

  it('the "none" policy drops the transitions altogether', () => {
    expect(buildVersionCss({ ...v2, reducedMotion: 'none' }, raw, { component: 'c' })).toMatch(/transition: none;/);
  });

  it('has no @keyframes: it is transitions', () => {
    expect(css).not.toContain('@keyframes');
  });
});

describe('the spec of an interaction version', () => {
  const md = buildVersionExport('side-panel', v2, panelVersions, tokens).markdown;

  it('lists the states and the transition into each, not a keyframe list', () => {
    expect(md).toContain('## States');
    expect(md).toContain('- closed (rest, where it starts): opacity 0, transform translateX(48px)');
    expect(md).toContain('- open: opacity 1, transform translateX(0px)');
    expect(md).toContain('## Transitions');
    expect(md).toContain('- **Into open**: duration.560 (560ms), easing easing.expressive-entrance');
    expect(md).toContain('Authored as a spring, bounce: bounce.50 (0.5)');
    expect(md).not.toContain('## What animates');
  });

  it('tells a developer to set data-state', () => {
    expect(md).toContain('set `data-state="<state>"` on it (closed, open)');
  });

  it('exports without throwing, tokens.css included', () => {
    const out = buildVersionExport('side-panel', v2, panelVersions, tokens);
    expect(out.tokensCss).toContain('--motion-duration-560: 560ms;');
    expect(out.tokensCss).toContain('--motion-distance-48: 48px;');
  });
});

describe('the GSAP and Motion code of states', () => {
  it('GSAP: the states, the timing into each, and a goTo that retargets', () => {
    const code = buildGsapCode(v2, raw, { component: 'side-panel' });
    expect(code).toContain('closed: { opacity: 0, x: 48 },');
    expect(code).toContain('open: { opacity: 1, x: 0 },');
    expect(code).toContain('open: { duration: 0.56, ease: "expressive-entrance" }');
    expect(code).toContain('closed: { duration: 0.3, ease: "productive-exit" }');
    expect(code).toContain('export function goToSidePanelV2(el, state)');
    expect(code).toContain('overwrite: "auto"');
    expect(code).toContain('GSAP has no springs');
  });

  it('Motion: springs into each state with the transition\'s bounce, and the honest note about speed', () => {
    const code = buildMotionCode(v2, raw, { component: 'side-panel' });
    expect(code).toContain('open: { animate: {"opacity":1,"x":0}, snap: {}, options: { type: "spring", visualDuration: 0.56, bounce: 0.5 } }, // bounce.50');
    expect(code).toContain('closed: { animate: {"opacity":0,"x":48}, snap: {}, options: { type: "spring", visualDuration: 0.3, bounce: 0 } }, // bounce.0');
    expect(code).toContain('export function goToSidePanelV2(el, state)');
    expect(code).toContain('do not carry the');
    expect(code).not.toContain('ease:');
  });

  // The GSAP code, run for real: moving to a state takes the CSS transition's duration and easing.
  it('the GSAP code runs in GSAP, and each move lasts as long as the CSS transition into that state', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const code = buildGsapCode(v2, raw, { component: 'side-panel' });
    const mod = new Function('gsap', 'CustomEase', 'window', `${code.replace(/^import .*$/gm, '').replace(/export function/g, 'function')}\nreturn { goToSidePanelV2, setupSidePanelV2 };`)(
      gsap, CustomEase, { matchMedia: () => ({ matches: false }) },
    ) as { goToSidePanelV2: (el: object, s: string) => gsap.core.Tween; setupSidePanelV2: (el: object) => void };
    const css = buildVersionCss(v2, raw, { component: 'side-panel' });
    const cssMs = (state: string): number => {
      const selector = state === 'closed' ? '\\.motion-side-panel-v2 \\{' : `\\.motion-side-panel-v2\\[data-state="${state}"\\] \\{`;
      const block = new RegExp(`${selector}([\\s\\S]*?)\\n\\}`).exec(css)![1]!;
      return parseFloat(/transition-duration: var\([^,]+, (\d+)ms\)/.exec(block)![1]!);
    };
    const el = { dataset: {} as Record<string, string> };
    mod.setupSidePanelV2(el);
    expect(el.dataset['state']).toBe('closed');
    for (const state of ['open', 'closed']) {
      const tween = mod.goToSidePanelV2(el, state);
      expect(tween.duration() * 1000, state).toBeCloseTo(cssMs(state), 3);
      expect(el.dataset['state']).toBe(state);
    }
  });
});
