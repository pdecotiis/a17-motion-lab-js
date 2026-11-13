// A toast: a small message that confirms an action, in the bottom right of the window. It slides up, stays a few seconds
// (it holds while the pointer is on it), then fades away; up to three show at once, the newest at the bottom. The way
// Sonner (sonner.emilkowal.ski) behaves, in the lab's own look. `toastAfterReload` is for an action that reloads the page
// (a dev-server write): the message is kept for the one view that comes back.

export type ToastKind = 'success' | 'error' | 'info';
export interface ToastOptions {
  /** A second line under the message. */
  description?: string;
  kind?: ToastKind;
  /** How long it stays, in ms (4000 by default). */
  duration?: number;
}

const PENDING_KEY = 'lab-toast-pending';
const DEFAULT_DURATION = 4000;
const MAX_VISIBLE = 3;
const EXIT_MS = 200;

const ICONS: Record<ToastKind, string> = {
  success: '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M6.5 10.2l2.4 2.4 4.6-4.9"/></svg>',
  error: '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M10 6v4.5M10 13.5v.01"/></svg>',
  info: '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M10 9v4.5M10 6.5v.01"/></svg>',
};

function region(): HTMLElement {
  let el = document.getElementById('lab-toasts');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lab-toasts';
    el.className = 'lab-toasts';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Notifications');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

/** Show a toast. */
export function toast(message: string, options: ToastOptions = {}): void {
  const kind = options.kind ?? 'success';
  const host = region();
  const el = document.createElement('div');
  el.className = `lab-toast lab-toast--${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  const icon = document.createElement('span');
  icon.className = 'lab-toast__icon';
  icon.innerHTML = ICONS[kind];
  const text = document.createElement('div');
  text.className = 'lab-toast__text';
  const title = document.createElement('div');
  title.className = 'lab-toast__title';
  title.textContent = message;
  text.appendChild(title);
  if (options.description) {
    const d = document.createElement('div');
    d.className = 'lab-toast__description';
    d.textContent = options.description;
    text.appendChild(d);
  }
  el.append(icon, text);
  host.appendChild(el);
  // The oldest go when there are more than three.
  const live = (): HTMLElement[] => [...host.querySelectorAll<HTMLElement>('.lab-toast:not(.lab-toast--leaving)')];
  while (live().length > MAX_VISIBLE) dismiss(live()[0]!);
  requestAnimationFrame(() => el.classList.add('lab-toast--in'));

  // The timer holds while the pointer is on the toast, and starts again from what is left when it goes.
  let remaining = options.duration ?? DEFAULT_DURATION;
  let started = performance.now();
  let timer = window.setTimeout(() => dismiss(el), remaining);
  el.addEventListener('pointerenter', () => {
    window.clearTimeout(timer);
    remaining -= performance.now() - started;
  });
  el.addEventListener('pointerleave', () => {
    started = performance.now();
    timer = window.setTimeout(() => dismiss(el), Math.max(remaining, 800));
  });
  el.addEventListener('click', () => dismiss(el));
}

function dismiss(el: HTMLElement): void {
  if (el.classList.contains('lab-toast--leaving')) return;
  el.classList.add('lab-toast--leaving');
  el.classList.remove('lab-toast--in');
  window.setTimeout(() => el.remove(), EXIT_MS);
}

/** Keep a toast for the one view that comes back after a reload. */
export function toastAfterReload(message: string, options: ToastOptions = {}): void {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ message, ...options })); } catch { /* storage can be blocked */ }
}

/** Forget a toast kept by `toastAfterReload` (the page did not reload after all). */
export function clearPendingToast(): void {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* storage can be blocked */ }
}

/** Show the toast kept by `toastAfterReload`, if there is one. */
export function showPendingToast(): void {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_KEY);
    const { message, ...options } = JSON.parse(raw) as { message?: unknown } & ToastOptions;
    if (typeof message === 'string' && message) toast(message, options);
  } catch { /* a broken entry is dropped */ }
}
