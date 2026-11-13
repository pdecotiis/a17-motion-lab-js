// The site's market dot field: the interactive dotted pattern that is the Jane Street site's full-page background. The pattern is drawn by the site's own modules
// (pattern-chunk.js, copied as they are from the site's build); this file is the small amount of code that runs them outside the site, ported from the search modal
// of the old Motion Lab, which already ran it:
//   - a tiny module loader for the chunk (the site's bundler is not here),
//   - the dot field's settings, read from the site's own component with React stubbed out (it hands its canvas the algorithm, the style and their parameters),
//   - a plain canvas loop in place of the React canvas component: it draws at 30 frames a second, pauses while off screen or the tab is hidden, and follows the
//     pointer and clicks (the dots react to both).
// The site's modules are untyped, so the types here stop at them.
import chunks from './pattern-chunk.js';

type SiteModule = Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any
type Factory = (ctx: LoaderContext) => void;
interface LoaderContext { v(exports: unknown): void; s(table: unknown[], id?: number): void; i(id: number): SiteModule; r(id: number): unknown }
interface Slot { exports: SiteModule; esm: boolean; ran?: boolean }
interface Field { algo: SiteModule; style: SiteModule; sc: { cellSize: number; background: string } & SiteModule; algoParams: SiteModule; styleParams: SiteModule }

// ----- the module loader: every chunk lists module ids followed by the factory that makes them
const factories: Record<number, Factory> = {};
for (const chunk of chunks) {
  let ids: number[] = [];
  chunk.forEach((entry, i) => {
    if (i === 0) return;
    if (typeof entry === 'function') { ids.forEach(id => { factories[id] = entry as Factory; }); ids = []; } else ids.push(entry as number);
  });
}
const noop = (): null => null;
const react: SiteModule = { createContext: () => ({ Provider: noop }), useState: noop, useEffect: noop, useRef: noop, useMemo: noop, useCallback: noop, useContext: noop, useId: noop, useLayoutEffect: noop };
const element = (type: unknown, props: unknown): { t: unknown; p: SiteModule } => ({ t: type, p: props as SiteModule });
// the modules the pattern code imports from the site: React, the JSX runtime and a CSS-modules shim
const stubs: Record<number, SiteModule> = {
  435325: { jsx: element, jsxs: element, Fragment: {} },
  700515: Object.assign({ default: react }, react),
  340137: { default: () => noop },
};
const slots: Record<number, Slot> = {};
const slot = (id: number): Slot => (slots[id] ??= { exports: {}, esm: false });
const namespace = (id: number): SiteModule | null => {
  const m = slots[id];
  return m ? (m.esm ? m.exports : Object.assign({ default: m.exports }, m.exports)) : null;
};
// the site's export tables: name, getter (and optionally setter), or name, undefined, value
function define(target: SiteModule, table: unknown[]): void {
  let i = 0;
  while (i < table.length) {
    const name = table[i++] as string, getter = table[i++];
    if (typeof getter === 'number') { Object.defineProperty(target, name, { value: table[i++], enumerable: true }); continue; }
    const descriptor: PropertyDescriptor = { get: getter as () => unknown, enumerable: true };
    if (typeof table[i] === 'function') descriptor.set = table[i++] as (v: unknown) => void;
    Object.defineProperty(target, name, descriptor);
  }
}
function load(id: number): SiteModule {
  if (stubs[id]) return stubs[id]!;
  if (slots[id]?.ran) return namespace(id)!;
  const factory = factories[id];
  if (!factory) return new Proxy({}, { get: () => noop });
  const m = slot(id);
  m.ran = true;
  const context: LoaderContext = {
    v: exports => { m.exports = exports as SiteModule; },
    s: (table, target) => { const t = target != null ? slot(target) : m; t.esm = true; t.ran = true; define(t.exports, table); },
    i: load,
    r: id2 => { const n = load(id2); return n && n.default !== undefined && !slots[id2]?.esm ? n.default : n; },
  };
  for (const other of Object.keys(factories)) if (factories[Number(other)] === factory && Number(other) !== id) slot(Number(other)).ran = true;
  factory(context);
  return namespace(id)!;
}

// ----- the dot field's settings
// These are the staging site's own (read from its running pattern, staging-jane-street.a17.dev, with its React props): the algorithm and the style are the site's modules, and this is what the
// site hands them. The speed is the site's (sqrt(22 / 100) * 3, the value of its latest curated date), the dots are the soft ones (controlsOpen false: the site blends every dot 60% toward the
// background) and the canvas is painted with the page colour on every frame (the site does not draw on a clear canvas). The cell size follows the window, the site's way.
const SITE_ALGO = { depth: 5, width: 15, weightScale: 0.8 + (3.7 * 5) / 10, outputContrast: 2, activation: 'mixed', timeRate: Math.sqrt(22 / 100) * 3, seed: 6857 };
const SITE_STYLE = { shape: 'dot', colorMode: 'mono', interaction: 5, dark: false, controlsOpen: false };
const LIGHT_BACKGROUND = '#F5F4F2', DARK_BACKGROUND = '#0D0D0D', LIGHTS_OUT = '#141414';   // the page's, the site's dark theme's, and the colour of the buttons (the black the opening starts in)
const siteCellSize = (): number => Math.min(24, Math.round(12 * Math.sqrt((window.innerWidth * window.innerHeight) / 1296e3)));
const pageIsDark = (): boolean => document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
let cached: Field | null | undefined;
function marketField(): Field | null {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    const scene = load(213690), market = load(641466);
    if (!market.MarketDotField) throw new Error('the market dot field module is missing');
    // The site's component runs once on stand-in hooks, only to read the props it hands to its canvas.
    const hooks: SiteModule = { useState: (initial: unknown) => [typeof initial === 'function' ? (initial as () => unknown)() : initial, noop], useEffect: noop, useMemo: (f: () => unknown) => f(), useRef: (value: unknown) => ({ current: value }) };
    const reactModule = stubs[700515]!;
    const kept: SiteModule = {}, keptModule: SiteModule = {};
    for (const key of Object.keys(hooks)) { kept[key] = react[key]; keptModule[key] = reactModule[key]; react[key] = hooks[key]; reactModule[key] = hooks[key]; }
    let canvasProps: SiteModule | undefined;
    try {
      const rendered = market.MarketDotField({ config: market.DEFAULT_MARKET_DOT_FIELD_CONFIG, active: true, controlsOpen: true });
      canvasProps = rendered?.p?.children?.p;
    } finally {
      for (const key of Object.keys(hooks)) { react[key] = kept[key]; reactModule[key] = keptModule[key]; }
    }
    if (!canvasProps?.algo || !canvasProps.style) throw new Error('the market dot field gave no canvas properties');
    const sc = { ...canvasProps['sceneParams'] } as Field['sc'];
    sc.cellSize = sc.cellSize || 12;
    cached = {
      algo: canvasProps.algo,
      style: canvasProps.style,
      sc,
      // the settings the loop reads: the site's defaults for the algorithm and the style, then the dot field's own
      algoParams: { ...scene.defaultsFor(canvasProps.algo.params ?? {}), ...SITE_ALGO },
      styleParams: { ...scene.defaultsFor(canvasProps.style.params ?? {}), ...SITE_STYLE },
    };
  } catch (error) {
    console.warn('market dot field', error);
  }
  return cached;
}

// ----- the canvas loop
const FRAME = 1000 / 30;
/** How far (px) the page scrolls before the pattern has faded out completely. */
const FADE_DISTANCE = 150;
/** The element the page scrolls in: the nearest ancestor that scrolls (the lab's page window), else the page itself. */
function scrollerOf(element: HTMLElement): HTMLElement | Window {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll')) return parent;   // not only one that already overflows: the page may still be laying out when this runs
  }
  return window;
}

const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Draw the dot field into the canvas in `container`, following the pointer. Returns a function that stops it, or null when the pattern code could not run. */
export function runDotField(container: HTMLElement): (() => void) | null {
  const canvas = container.querySelector('canvas');
  const field = marketField();
  if (!canvas || !field) return null;
  const noise = load(615644)['noise3D'];
  const { algo, style, sc, algoParams, styleParams } = field;
  const reduced = reducedMotion();
  let size = { w: 0, h: 0 }, algoState: unknown = null, styleState: unknown = null, key = '', last: number | null = null, clock = 0, frame = 0, previous = 0;
  let faded = false;   // scrolled far enough that the pattern is gone: nothing is drawn
  let mouse: { x: number; y: number } | null = null, visible = true, clicks: { x: number; y: number; time: number }[] = [];
  // ----- a version of the pattern that opens in the dark (the page's "lights up": the component's states are 'dark', then 'light')
  // One number, `darkness`, runs the whole change from the dark to the light, so the pattern and the page behind it are one thing changing, not two things swapped: it is 1 while the component
  // is in its 'dark' state and eases to 0 over 800ms (the expressive-standard curve) once the state is 'light'. It sets, together and on every frame: the opacity of the black veil behind the dots
  // (the colour of the buttons), the opacity of the two palettes the dots are drawn in (the site's own light and dark ones, drawn from the same values, so a dot is the same dot in both: the
  // dark canvas is as opaque as the veil, the light one as clear), and the page-coloured overlay that leaves the dots only at the top of the content column (it comes in only once the dark is
  // half gone). While it is dark the field is also more agitated (it runs its clock four times as fast, and more contrasty), and it settles back as the lights come up. When the lights start to come
  // up the field gets one click, from the bottom middle of the page, and the ring that comes out of it is orange (the first of the accent colours).
  const stateOf = (): string | null => container.closest('[data-motion-target]')?.getAttribute('data-state') ?? null;
  const veil = container.parentElement?.querySelector<HTMLElement>('.page-intro-pattern__veil') ?? null;
  const fadeOverlay = container.querySelector<HTMLElement>('.page-intro-pattern__fade');
  const darkCanvas = document.createElement('canvas');
  darkCanvas.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;opacity:0;';
  canvas.after(darkCanvas);
  const ORANGE = [255, 150, 100];   // --background-accent-primary (#F57853), a little brighter so the ring reads on the dark and the light
  const RING_SLOWDOWN = 2;         // the site's ripple lasts 1.2s and travels at 600px/s; the page's lasts twice as long and travels half as fast, so it holds
  const RING_STRENGTH = 2.2, RING_SIZE = 3.2;   // the rings along the bottom of the page (a version's 'light' state)
  // (the strength is how far the dots go toward the colour: more than 1 is brighter than the colour itself; RING_SIZE is how much they swell)
  const LIGHTS_MS = 800;
  const ease = (x: number): number => {   // cubic-bezier(0.45, 0.05, 0.35, 1)
    let lo = 0, hi = 1, t = x;
    const bez = (u: number, p1: number, p2: number): number => 3 * (1 - u) * (1 - u) * u * p1 + 3 * (1 - u) * u * u * p2 + u * u * u;
    for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (bez(t, 0.45, 0.35) < x) lo = t; else hi = t; }
    return bez(t, 0.05, 1);
  };
  let darkness = stateOf() === 'dark' ? 1 : 0, lightsAt: number | null = null, wasDark = darkness === 1;
  const pulseColours = new Map<number, number[]>();   // the start time of each of the page's clicks, and the colour of its ring
  const pulseStrength = new Map<number, number>();    // and how strongly it takes that colour
  const pulseStart = new WeakMap<object, number>();   // each ring of the page's: the time it really began (its start time is moved every frame to slow it down)
  // A version can give the change from dark to light a time of its own, by animating the opacity of the .page-intro-pattern__lights element (1 = dark, 0 = light): from the moment that animation exists, how dark the
  // page is is that opacity, on every frame, and the state is not used.
  const lights = container.parentElement?.querySelector<HTMLElement>('.page-intro-pattern__lights') ?? null;
  let sawLights = false;
  // A version can make the dots stronger for a while by animating the opacity of the invisible .page-intro-pattern__strength element (1 = at their strongest, 0 = as they are). The strength goes into the site's own drawing of a dot
  // as `boost` (see the two changes marked "boost" in pattern-chunk.js): a dot is its colour mixed from the page colour toward the dot colour, and a boost of 1 takes the soft pull-back off that mix (a dot of 12% is 29%) and
  // lets it go all the way (a factor of 1 for .85: 35%). The mix itself changes, a dot's own colour on every frame, so it moves smoothly from one strength to the other and never passes the page colour (no flash). Without an
  // animation on the element the strength is 0 and the dots are drawn as the site draws them.
  const strengthEl = container.parentElement?.querySelector<HTMLElement>('.page-intro-pattern__strength') ?? null;
  let sawStrength = false;
  const strengthNow = (): number => {
    if (!strengthEl) return 0;
    if (strengthEl.getAnimations().length > 0) sawStrength = true;
    return sawStrength ? Math.max(0, Math.min(1, parseFloat(getComputedStyle(strengthEl).opacity) || 0)) : 0;
  };
  const updateDarkness = (now: number): void => {
    if (lights && lights.getAnimations().length > 0) sawLights = true;
    if (sawLights) { darkness = parseFloat(getComputedStyle(lights!).opacity) || 0; return; }
    const state = stateOf();
    if (state === 'dark') { darkness = 1; lightsAt = null; wasDark = true; }
    else if ((state === 'light' || state === 'white') && wasDark) {   // the lights come up ('light': with the rings that come out of the bottom of the page, 'white': without them)
      wasDark = false; lightsAt = now;
      if (state === 'light') {
        // three clicks along the bottom of the page (left, middle, right), a beat apart, so three rings come out of it and spread over the page
        const { w } = size;
        [[w / 2, 0], [w * 0.22, 130], [w * 0.78, 260]].forEach(([x, delay]) => window.setTimeout(() => { const time = performance.now(); pulseColours.set(time, ORANGE); pulseStrength.set(time, RING_STRENGTH); clicks.push({ x: x!, y: size.h, time }); }, delay));
      }
    }
    if (lightsAt !== null) darkness = 1 - ease(Math.min(1, (now - lightsAt) / LIGHTS_MS));
    if (state === null) darkness = 0;
  };
  canvas.style.filter = 'none';
  const dpr = (): number => window.devicePixelRatio || 1;
  function fit(c: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
    const d = dpr();
    if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
    const ctx = c.getContext('2d');
    ctx?.setTransform(d, 0, 0, d, 0, 0);
    return ctx;
  }

  function draw(): void {
    const { w, h } = size;
    if (!w || !h) return;
    const ctx = fit(canvas!, w, h);
    if (!ctx) return;
    const cell = Math.max(4, sc.cellSize), cols = Math.max(1, Math.ceil(w / cell)), rows = Math.max(1, Math.ceil(h / cell)), now = performance.now();
    updateDarkness(now);
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    sc.cellSize = siteCellSize();
    clock += dt;
    const scene = { width: w, height: h, cols, rows, cellSize: cell, mouseX: mouse ? mouse.x : -1, mouseY: mouse ? mouse.y : -1, mouseInCanvas: mouse !== null, hoverEffect: mouse !== null, noise3D: noise, clicks };
    clicks = [];
    const layout = `${cols}x${rows}x${cell}`;
    if (layout !== key || algoState === null) algoState = algo.init ? algo.init(algoParams, scene) : null;
    if (layout !== key || styleState === null) styleState = style.init ? style.init(styleParams, scene) : null;
    key = layout;
    if (algo.step) algo.step(algoState, algoParams, scene, dt);
    if (style.step) style.step(styleState, styleParams, scene, dt);
    // the ring from the page's click is orange, not a colour picked at random
    const rippleState = styleState as { ripples?: { startTime: number; color: number[] }[]; rippleStrength?: number; rippleSizeBoost?: number } | null;
    let ringUp = false, strength = 0;
    for (const ripple of rippleState?.ripples ?? []) {
      if (!pulseStart.has(ripple) && pulseColours.has(ripple.startTime)) { pulseStart.set(ripple, ripple.startTime); ripple.color = pulseColours.get(ripple.startTime)!; }
      const began = pulseStart.get(ripple);
      if (began === undefined) continue;
      ripple.startTime = now - (now - began) / RING_SLOWDOWN;   // the site's ripple, run slower
      ringUp = true;
      strength = Math.max(strength, pulseStrength.get(began) ?? RING_STRENGTH);
    }
    if (ringUp && rippleState) { rippleState.rippleStrength = strength; rippleState.rippleSizeBoost = RING_SIZE; }
    // the two palettes: the light one (the site's) and the dark one, each drawn on a canvas of its own and crossfaded by `darkness`
    const drawDark = darkness > 0;
    const ctxDark = drawDark ? fit(darkCanvas, w, h) : null;
    // the site paints its canvas with the page colour on every frame; the light one is the page's (or the site's dark theme's, on a dark page) and the other is always dark, near-black
    const pageDark = pageIsDark();
    ctx.fillStyle = pageDark ? DARK_BACKGROUND : LIGHT_BACKGROUND; ctx.clearRect(0, 0, w, h); ctx.fillRect(0, 0, w, h);
    if (ctxDark) { ctxDark.clearRect(0, 0, w, h); ctxDark.fillStyle = LIGHTS_OUT; ctxDark.fillRect(0, 0, w, h); }
    const mainParams = { ...styleParams, dark: pageDark, boost: strengthNow() };
    const darkParams = { ...styleParams, dark: true };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const value = algo.sample(algoState, algoParams, scene, r, c, clock);
        const extra = { state: styleState, r, c, dt, rows, cols, background: pageDark ? DARK_BACKGROUND : LIGHT_BACKGROUND, mouseX: scene.mouseX, mouseY: scene.mouseY, mouseInCanvas: scene.mouseInCanvas, cellSize: cell, t: clock, noise3D: noise };
        style.drawCell(ctx, c * cell + cell / 2, r * cell + cell / 2, cell, value, mainParams, extra);
        if (ctxDark) style.drawCell(ctxDark, c * cell + cell / 2, r * cell + cell / 2, cell, value, darkParams, { ...extra, background: LIGHTS_OUT });
      }
    }
    if (style.drawFrame) { style.drawFrame(ctx, w, h, mainParams, styleState); if (ctxDark) style.drawFrame(ctxDark, w, h, darkParams, styleState); }
    canvas!.style.opacity = String(1 - darkness);
    darkCanvas.style.opacity = String(darkness);
    if (veil) veil.style.opacity = String(darkness);
    // where the page's left edge is (the page is centred in a wider window), for the page-coloured edge of the dots
    const gridLeft = container.closest('.lab-page-grid')?.getBoundingClientRect().left ?? 0, rootLeft = container.getBoundingClientRect().left;
    container.parentElement?.style.setProperty('--grid-left', `${Math.round(gridLeft - rootLeft)}px`);
    if (fadeOverlay) fadeOverlay.style.opacity = String(Math.max(0, Math.min(1, 1 - 2 * darkness)));
  }
  function loop(time: number): void {
    frame = 0;
    if (!visible || !container.isConnected) return;
    if (!document.hidden && !faded && time - previous >= FRAME) { previous = time; draw(); }
    frame = requestAnimationFrame(loop);
  }

  const cleanups: (() => void)[] = [];
  const resize = new ResizeObserver(entries => { const r = entries[0]!.contentRect; size = { w: r.width, h: r.height }; if (reduced) draw(); });
  resize.observe(container);
  cleanups.push(() => resize.disconnect());
  if (reduced) {
    draw();
  } else {
    const onScreen = new IntersectionObserver(entries => { visible = entries[0]!.isIntersecting; if (visible && !frame) frame = requestAnimationFrame(loop); });
    onScreen.observe(container);
    cleanups.push(() => onScreen.disconnect());
    const listen = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void): void => { window.addEventListener(type, fn); cleanups.push(() => window.removeEventListener(type, fn)); };
    listen('mousemove', e => {
      const b = container.getBoundingClientRect();
      mouse = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom ? { x: e.clientX - b.left, y: e.clientY - b.top } : null;
    });
    listen('mouseout', e => { if (!e.relatedTarget) mouse = null; });
    listen('click', e => { const b = container.getBoundingClientRect(); clicks.push({ x: e.clientX - b.left, y: e.clientY - b.top, time: performance.now() }); });
    frame = requestAnimationFrame(loop);
  }
  // The pattern fades out as the page scrolls down, and is back when it scrolls to the top.
  const scroller = scrollerOf(container);
  const fade = (): void => {
    const top = scroller instanceof Window ? scroller.scrollY : scroller.scrollTop;
    const opacity = Math.max(0, 1 - top / FADE_DISTANCE);
    container.style.opacity = String(opacity);
    faded = opacity === 0;
  };
  scroller.addEventListener('scroll', fade, { passive: true });
  cleanups.push(() => scroller.removeEventListener('scroll', fade));
  fade();
  return () => { cancelAnimationFrame(frame); cleanups.forEach(fn => fn()); };
}
