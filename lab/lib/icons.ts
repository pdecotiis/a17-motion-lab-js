// The lab's few icons: 20px line icons in currentColor (so they take the button's colour in both themes), drawn with a
// 1.5px round stroke to sit beside the kit's type. Decorative: the button carries the accessible name.

const svg = (body: string): string =>
  `<svg class="lab-icon" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  /** Two sliders: Settings. */
  settings: svg('<path d="M3 6h8M15 6h2M3 14h2M9 14h8"/><circle cx="13" cy="6" r="2"/><circle cx="7" cy="14" r="2"/>'),
  sun: svg('<circle cx="10" cy="10" r="3.5"/><path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1 1M14.3 14.3l1 1M4.7 15.3l1-1M14.3 5.7l1-1"/>'),
  moon: svg('<path d="M16.5 11.7A6.7 6.7 0 1 1 8.3 3.5a5.4 5.4 0 0 0 8.2 8.2z"/>'),
  close: svg('<path d="M5 5l10 10M15 5L5 15"/>'),
} as const;

export type IconName = keyof typeof ICONS;
