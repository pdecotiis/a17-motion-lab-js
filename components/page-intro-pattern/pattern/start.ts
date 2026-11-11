import { runDotField } from './runtime.js';

// The lab shows a component by putting its markup on the page, in the component view, the page view and the library's cards, and the markup cannot run a
// script. So this watches the page: whenever a dot field container (data-dot-field) appears, the pattern starts in it; it stops by itself when the
// container leaves the page (the loop ends when the element is no longer connected).
const SELECTOR = '[data-dot-field]';
const running = new WeakSet<Element>();

function start(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(SELECTOR).forEach(container => {
    if (running.has(container)) return;
    running.add(container);
    runDotField(container);
  });
}

export function watchDotFields(): void {
  if (typeof document === 'undefined') return;   // the unit tests load every component in Node
  start(document);
  new MutationObserver(mutations => {
    for (const mutation of mutations) mutation.addedNodes.forEach(node => { if (node instanceof Element) { if (node.matches(SELECTOR)) start(node.parentNode ?? document); else start(node); } });
  }).observe(document.documentElement, { childList: true, subtree: true });
}
