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
      algoParams: { ...scene.defaultsFor(canvasProps.algo.params ?? {}), ...canvasProps['algoParams'] },
      styleParams: { ...scene.defaultsFor(canvasProps.style.params ?? {}), ...canvasProps['styleParams'] },
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
    if ((overflow === 'auto' || overflow === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
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
  canvas.style.opacity = '1';
  canvas.style.filter = 'none';

  function draw(): void {
    const ctx = canvas!.getContext('2d');
    const { w, h } = size;
    if (!ctx || !w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas!.width !== Math.round(w * dpr) || canvas!.height !== Math.round(h * dpr)) { canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cell = Math.max(4, sc.cellSize), cols = Math.max(1, Math.ceil(w / cell)), rows = Math.max(1, Math.ceil(h / cell)), now = performance.now();
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    const scene = { width: w, height: h, cols, rows, cellSize: cell, mouseX: mouse ? mouse.x : -1, mouseY: mouse ? mouse.y : -1, mouseInCanvas: mouse !== null, hoverEffect: mouse !== null, noise3D: noise, clicks };
    clicks = [];
    const layout = `${cols}x${rows}x${cell}`;
    if (layout !== key || algoState === null) algoState = algo.init ? algo.init(algoParams, scene) : null;
    if (layout !== key || styleState === null) styleState = style.init ? style.init(styleParams, scene) : null;
    key = layout;
    if (algo.step) algo.step(algoState, algoParams, scene, dt);
    if (style.step) style.step(styleState, styleParams, scene, dt);
    ctx.clearRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const value = algo.sample(algoState, algoParams, scene, r, c, clock);
        style.drawCell(ctx, c * cell + cell / 2, r * cell + cell / 2, cell, value, styleParams, {
          state: styleState, r, c, dt, rows, cols, background: sc.background, mouseX: scene.mouseX, mouseY: scene.mouseY, mouseInCanvas: scene.mouseInCanvas, cellSize: cell, t: clock, noise3D: noise,
        });
      }
    }
    if (style.drawFrame) style.drawFrame(ctx, w, h, styleParams, styleState);
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
