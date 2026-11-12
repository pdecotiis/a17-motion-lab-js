import type { ProjectTrigger } from '../lab/lib/project-triggers.js';

// scroll-expand: as the page scrolls, one cell of a grid grows to fill the page's container (the column the component is in, as tall as the window, inside the page's margins) and the cells
// around it collapse to nothing, while the grid stays pinned. It is the scroll effect of the reference site, as a collapse rather than a zoom: nothing is scaled.
// The side columns lose their width (flex-grow to 0), the cells above and below the grown one lose their height, the grown one takes all that is left (it always
// fills the space exactly), and the grid grows from its own size to 2:1 (as wide as the margins allow, half as tall), in the middle of the window. The gutters stay 8px while there is anything to be a gutter to: a gutter only
// goes (over its last 8px) as the cell beside it disappears. The words and arrows on a card fade out as it collapses. It is scrubbed by the scroll (no easing), so it comes and goes with the scrollbar, and the root clips it: it
// never goes over the menu or the header.
//   { on: 'scroll-expand', cell: 'p1a' }      cell = the data-motion name of the cell that grows
// What it needs of the component's CSS: the grid is `position: sticky` while `data-scroll-expand` is on the root (this trigger sets it), its columns are flex
// items that share the width (`flex: 1 1 0`), and the root clips (`overflow: clip`). The trigger sets `--scroll-expand-distance` on the root: one window of scroll.
type Settings = { on: 'scroll-expand'; cell: string };

const clamp = (n: number): number => Math.min(1, Math.max(0, n));
const lerp = (from: number, to: number, p: number): number => from + (to - from) * p;

/** The element the page scrolls in: the nearest ancestor that scrolls (the lab's page window), else the page itself. */
function scrollerOf(element: HTMLElement): HTMLElement | Window {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll')) return parent;   // not only one that already overflows: the page may still be laying out when this runs
  }
  return window;
}

const trigger: ProjectTrigger = {
  name: 'scroll-expand',

  validate(settings, { id }) {
    const { cell } = settings as unknown as Partial<Settings>;
    if (typeof cell !== 'string' || !/^[a-z][a-z0-9-]*$/.test(cell)) throw new Error(`${id} scroll-expand trigger needs "cell": the data-motion name of the cell that grows, such as 'p1a'`);
  },

  attach(settings, ctx) {
    const { cell } = settings as unknown as Settings;
    const root = ctx.el;
    const grid = root.querySelector<HTMLElement>('[data-motion="grid"]');
    const grown = root.querySelector<HTMLElement>(`[data-motion="${cell}"]`);
    if (!grid || !grown || ctx.reducedMotion()) return () => {};
    const column = grown.parentElement as HTMLElement;
    const sideColumns = [...grid.children].filter((child): child is HTMLElement => child !== column && child instanceof HTMLElement);
    const neighbours = [...column.children].filter((child): child is HTMLElement => child !== grown && child instanceof HTMLElement);
    const scroller = scrollerOf(root);
    root.setAttribute('data-scroll-expand', '');

    // What everything is at rest, measured from the layout (not the screen: a card still rising in does not throw it off). In the page's own pixels: the lab may
    // show the page zoomed to fit, and `zoom` is that factor.
    const fading = [...sideColumns, ...neighbours].flatMap(c => [...c.querySelectorAll<HTMLElement>('[data-motion^="title-"], [data-motion^="arrow-"]')]);
    let rest = { sideW: 0, zoom: 1, windowH: 1, windowTop: 0, gridW: 0, gridH: 0, pinned: 0, pad: 0, gap: 0, cellH: 0, cellGutter: 0, neighbourH: [] as number[], neighbourGap: [] as number[], radius: 0, paddingTop: 0 };
    const measure = (): void => {
      clear();
      const zoom = grid.getBoundingClientRect().width / (grid.offsetWidth || 1) || 1;
      const view = scroller instanceof Window ? { h: window.innerHeight, top: 0 } : { h: scroller.clientHeight, top: scroller.getBoundingClientRect().top };
      const style = getComputedStyle(root);
      rest = {
        sideW: sideColumns[0]?.offsetWidth ?? 0, zoom, windowH: view.h / zoom, windowTop: view.top, gridW: grid.offsetWidth, gridH: grid.offsetHeight, pinned: parseFloat(getComputedStyle(grid).top) || 0,
        pad: parseFloat(style.paddingLeft) || 0, paddingTop: parseFloat(style.paddingTop) || 0, gap: parseFloat(getComputedStyle(grid).columnGap) || 0,
        cellH: grown.offsetHeight, cellGutter: parseFloat(getComputedStyle(grown).marginBottom) || 0, neighbourH: neighbours.map(n => n.offsetHeight), neighbourGap: neighbours.map(n => parseFloat(getComputedStyle(n).marginBottom) || 0),
        radius: parseFloat(getComputedStyle(grown).borderTopLeftRadius) || 0,
      };
      root.style.setProperty('--scroll-expand-distance', `${rest.windowH}px`);
      root.style.height = '';
      root.style.height = `${root.offsetHeight}px`;   // fixed: the grid changing size must not change the page's height (the scroll would shift with it)
      update();
    };
    const clear = (): void => {
      fading.forEach(e => e.style.removeProperty('opacity'));
      for (const style of [grid.style, grown.style, ...sideColumns.map(c => c.style), ...neighbours.map(n => n.style)]) {
        ['width', 'height', 'top', 'marginLeft', 'columnGap', 'aspectRatio', 'flexGrow', 'marginBottom', 'borderRadius'].forEach(property => style.removeProperty(property.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)));
      }
    };
    const update = (): void => {
      const naturalTop = (root.getBoundingClientRect().top - rest.windowTop) / rest.zoom + rest.paddingTop;   // where the grid would be without being pinned
      const scrolled = clamp((rest.pinned - naturalTop) / rest.windowH);
      if (scrolled === 0) { clear(); return; }
      const p = clamp(scrolled / 0.95);   // it is done a little before the end of the scroll, so it holds still at the end
      // the grid grows from its own size to the container's (edge to edge, one window tall), pinned a margin below the top of the window by the end, with a margin below it too
      const gridW = rest.gridW, endH = gridW / 2;   // it ends 2:1 (as wide as the margins allow, half as tall), in the middle of the window
      const gridH = lerp(rest.gridH, endH, p);
      grid.style.top = `${lerp(rest.pinned, Math.max(rest.pad, (rest.windowH - endH) / 2), p)}px`;
      grid.style.aspectRatio = 'auto';
      grid.style.height = `${gridH}px`;
      // the side columns share what the others leave; the gutter beside them stays 8px until they are about to be gone
      const sideW = Math.max(0, ((gridW - 2 * rest.gap) * (1 - p)) / (1 + 2 * (1 - p)));
      grid.style.columnGap = `${Math.min(rest.gap, sideW)}px`;
      sideColumns.forEach(c => { c.style.flexGrow = String(1 - p); });
      // the cells above and below the grown one give up their height, with a gutter that stays 8px until each is about to be gone; the grown one takes the rest
      const heights = neighbours.map((_, i) => lerp(rest.neighbourH[i]!, 0, p));
      const lastShown = heights.reduce((last, h, i) => (rest.neighbourH[i]! > 0 ? i : last), -1);
      const gutters = heights.map((h, i) => (i === lastShown || rest.neighbourH[i]! === 0 ? 0 : Math.min(rest.neighbourGap[i]!, h)));
      const below = heights.reduce((sum, h) => sum + h, 0);
      const cellGutter = Math.min(rest.cellGutter, below);
      neighbours.forEach((n, i) => { n.style.height = `${heights[i]}px`; n.style.marginBottom = `${gutters[i]}px`; });
      grown.style.marginBottom = `${cellGutter}px`;
      grown.style.height = `${gridH - cellGutter - below - gutters.reduce((sum, g) => sum + g, 0)}px`;
      // what is written on a collapsing card fades out in the first half of the scroll
      fading.forEach(e => { e.style.opacity = String(clamp(1 - p / 0.5)); });
    };
    let frame = 0;
    const onScroll = (): void => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(frame);
      clear();
      root.style.removeProperty('height');
      root.style.removeProperty('--scroll-expand-distance');
      root.removeAttribute('data-scroll-expand');
    };
  },

  describe(settings) {
    const { cell } = settings as unknown as Settings;
    return {
      heading: 'Scroll expand',
      summary: `As the page scrolls, ${cell} grows to fill the page's container and the cells around it collapse; the grid stays pinned while it does (not over the menu).`,
      led: [],
      event: 'scroll-expand',
      on: 'the page scroll',
      means: 'the scroll position, one window of scrolling',
      what: `grows \`data-motion="${cell}"\` to fill the container (one window tall) and collapses the cells around it (the side columns lose their width, the cells above and below it their height; the gutters stay 8px until a cell is about to be gone, and what is written on a collapsing card fades out), scrubbed by the scroll with no easing, with the grid pinned (\`position: sticky\`) and clipped by its root. The CSS has no scroll link: the GSAP and Motion \`attach…(el)\` functions run it`,
    };
  },

  exportCode() {
    return [
      '// scroll-expand: the grid is pinned (position: sticky) and clipped by its root; as the page scrolls the cell grows to fill the container and the cells around it collapse',
      'const grid = el.querySelector(\'[data-motion="grid"]\');',
      'const grown = el.querySelector(\'[data-motion="\' + t.cell + \'"]\');',
      'const column = grown.parentElement;',
      'const sides = [...grid.children].filter(child => child !== column);',
      'const neighbours = [...column.children].filter(child => child !== grown);',
      'const lerp = (from, to, p) => from + (to - from) * p;',
      'let rest;',
      'const measure = () => {',
      '  const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;',
      '  rest = { pad, pinned: parseFloat(getComputedStyle(grid).top) || 0, paddingTop: parseFloat(getComputedStyle(el).paddingTop) || 0, gridW: grid.offsetWidth, gridH: grid.offsetHeight, gap: parseFloat(getComputedStyle(grid).columnGap) || 0, cellH: grown.offsetHeight, neighbours: neighbours.map(n => n.offsetHeight), windowH: innerHeight };',
      '  el.style.setProperty("--scroll-expand-distance", rest.windowH + "px");',
      '};',
      'const update = () => {',
      '  const p = Math.min(1, Math.max(0, (rest.pinned - (el.getBoundingClientRect().top + rest.paddingTop)) / rest.windowH));',
      '  const endH = rest.gridW / 2;',
      '  const gridH = lerp(rest.gridH, endH, p);',
      '  grid.style.top = lerp(rest.pinned, Math.max(rest.pad, (rest.windowH - endH) / 2), p) + "px";',
      '  grid.style.aspectRatio = "auto";',
      '  grid.style.height = gridH + "px";',
      '  grid.style.columnGap = lerp(rest.gap, 0, p) + "px";',
      '  sides.forEach(side => { side.style.flexGrow = 1 - p; });',
      '  grown.style.height = lerp(rest.cellH, gridH, p) + "px";',
      '  neighbours.forEach((n, i) => { n.style.height = lerp(rest.neighbours[i], 0, p) + "px"; n.style.marginBottom = lerp(8, 0, p) + "px"; });',
      '};',
      'if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {',
      '  measure();',
      '  update();',
      '  window.addEventListener("scroll", update);',
      '  window.addEventListener("resize", () => { measure(); update(); });',
      '}',
    ];
  },
};

export default trigger;
