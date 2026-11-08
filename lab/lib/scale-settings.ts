import { SCALES } from './scales.js';
import { tokenDisplayName } from './token-names.js';
import { previewScale, describeScaleConfig, SCALE_KINDS, type Json } from './scale-apply.js';

// The Global scale setting, shown in the Settings panel (the gear in the header). It is a
// setting you change rarely: how the distance, duration, delay, opacity and scale tokens get their
// values. This previews a scale against the real tokens and, with the dev server, applies it.

export const SCALE_FLASH_KEY = 'a17-motion-lab-scale-flash';

export interface ScaleSettingsDeps {
  /** The token file, as imported. */
  tokens: Json;
  /** The versions (as `component/version`) that use a token. */
  usedBy: (path: string) => string[];
}

// The scale being previewed, kept while the panel is open.
let previewScaleId = 'major-third';

// The Global scale setting (in the Settings panel): what each scale would do to the tokens, before
// anyone applies it, and a button that applies it.
export function renderScaleSettings(container: HTMLElement, deps: ScaleSettingsDeps): void {
  container.replaceChildren(buildScaleSettings(container, deps));
}

function buildScaleSettings(container: HTMLElement, deps: ScaleSettingsDeps): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'lab-scale-panel';
  // What the last apply did (the page reloads after it, so it is kept for this one view).
  try {
    const flash = sessionStorage.getItem(SCALE_FLASH_KEY);
    if (flash) {
      sessionStorage.removeItem(SCALE_FLASH_KEY);
      const el = document.createElement('p');
      el.id = 'scale-flash';
      el.className = 'lab-scale-panel__flash';
      el.setAttribute('role', 'status');
      el.textContent = flash;
      panel.appendChild(el);
    }
  } catch { /* storage can be blocked */ }
  const heading = (text: string, tag: 'p' | 'h3' = 'p'): HTMLElement => {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
  };

  // What the tokens follow now.
  const { custom, kinds: recorded } = describeScaleConfig(deps.tokens);
  const label = (id: string): string => SCALES.find(s => s.id === id)?.label ?? `ratio ${id}`;
  const now = heading(custom
    ? 'The tokens follow no scale: Custom, their values were set by hand.'
    : `The tokens follow: ${Object.entries(recorded).map(([k, v]) => `${k} ${label(v!.scale)}`).join(', ')}.`);
  now.id = 'scale-current';
  now.className = 'lab-scale-panel__current';

  // The scale to preview.
  const select = document.createElement('select');
  select.id = 'scale-preview-select';
  select.className = 'lab-select';
  select.setAttribute('aria-label', 'Scale to preview');
  for (const s of SCALES) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.label} (${s.note})`;
    select.appendChild(opt);
  }
  select.value = previewScaleId;
  select.addEventListener('change', () => {
    previewScaleId = select.value;
    renderScaleSettings(container, deps);
  });

  const preview = previewScale(deps.tokens, previewScaleId, deps.usedBy);
  const summary = heading(preview.error
    ? `${label(previewScaleId)} doesn't fit: ${preview.error}`
    : `${label(previewScaleId)} would rename ${preview.renamed} token${preview.renamed === 1 ? '' : 's'} and change ${preview.versions.length} version file${preview.versions.length === 1 ? '' : 's'}.`);
  summary.id = 'scale-summary';
  summary.className = 'lab-scale-panel__summary' + (preview.error ? ' lab-scale-panel__summary--error' : '');

  panel.append(now, select, summary);

  // Each kind: the current tokens next to the ones that would take their place.
  // The same accordion as the component view's panels (a <details>: the title is the summary).
  const changes = document.createElement('details');
  changes.className = 'lab-controls lab-accordion lab-scale-changes';
  changes.id = 'scale-changes';
  changes.open = true;
  const changesTitle = document.createElement('summary');
  changesTitle.className = 'lab-controls__title';
  changesTitle.textContent = 'What changes';
  const changesBody = document.createElement('div');
  changesBody.className = 'lab-accordion__body';
  changes.append(changesTitle, changesBody);
  for (const kind of SCALE_KINDS) {
    const rows = preview.rows.filter(r => r.kind === kind);
    if (rows.length === 0) continue;
    changesBody.appendChild(heading(kind, 'h3')).className = 'lab-tokens-heading';
    const table = document.createElement('table');
    table.className = 'lab-tokens-table lab-scale-table';
    table.dataset['kind'] = kind;
    const head = table.createTHead().insertRow();
    for (const t of ['Now', 'Becomes', 'Used by']) {
      const th = document.createElement('th');
      th.textContent = t;
      head.appendChild(th);
    }
    const body = table.createTBody();
    for (const r of rows) {
      const tr = body.insertRow();
      tr.className = 'lab-scale-row' + (r.renamed ? ' lab-scale-row--renamed' : '');
      const cell = (token: { path: string; value: string } | null, empty: string, changed: boolean): void => {
        const td = tr.insertCell();
        if (!token) { td.textContent = empty; td.className = 'lab-text-muted'; return; }
        const chip = document.createElement('code');
        chip.className = 'lab-scale-chip' + (changed ? ' lab-scale-chip--changed' : '');
        chip.textContent = tokenDisplayName(token.path);
        chip.title = `${token.path}: ${token.value}`;
        td.appendChild(chip);
      };
      cell(r.from, 'new step', r.renamed);
      cell(r.to, 'folds into the last step', false);
      const used = tr.insertCell();
      used.textContent = r.usedBy.length ? r.usedBy.join(', ') : '';
      if (!r.usedBy.length) used.className = 'lab-text-muted';
    }
    changesBody.appendChild(table);
  }
  panel.appendChild(changes);

  // Apply it: the button talks to the dev server, which runs the same generator as the command.
  panel.append(buildApplySection(previewScaleId, preview.renamed, preview.versions.length, !!preview.error));

  return panel;
}

// The Apply section of the Global scale setting: a button (with a confirmation step), a note for when
// there is no dev server to apply with, and the command for doing it by hand.
function buildApplySection(scaleId: string, renamed: number, versionCount: number, blocked: boolean): HTMLElement {
  const section = document.createElement('div');
  section.className = 'lab-scale-apply';
  const title = document.createElement('h3');
  title.className = 'lab-tokens-heading';
  title.textContent = 'Apply it';
  const note = document.createElement('p');
  note.className = 'lab-scale-panel__how';
  note.id = 'scale-apply-note';
  const actions = document.createElement('div');
  actions.className = 'lab-scale-apply__actions';

  const apply = document.createElement('button');
  apply.className = 'lab-btn lab-btn--primary';
  apply.id = 'scale-apply-btn';
  apply.textContent = `Apply ${SCALES.find(s => s.id === scaleId)?.label ?? scaleId}`;
  apply.disabled = true;
  const confirm = document.createElement('button');
  confirm.className = 'lab-btn lab-btn--primary';
  confirm.id = 'scale-apply-confirm';
  confirm.textContent = 'Yes, apply';
  const cancel = document.createElement('button');
  cancel.className = 'lab-btn lab-btn--sm';
  cancel.id = 'scale-apply-cancel';
  cancel.textContent = 'Cancel';
  const result = document.createElement('p');
  result.id = 'scale-apply-result';
  result.setAttribute('role', 'status');
  const showActions = (confirming: boolean): void => {
    actions.replaceChildren(...(confirming ? [confirm, cancel] : [apply]));
    note.textContent = confirming
      ? `This renames ${renamed} token${renamed === 1 ? '' : 's'} in tokens/motion.json and edits ${versionCount} version file${versionCount === 1 ? '' : 's'}. Save your work first so you can go back.`
      : 'Renames the tokens in tokens/motion.json and the references to them in the version files. Save your work first so you can go back.';
  };
  showActions(false);

  // The button only works with the dev server: a built copy has nothing to write the files with.
  fetch('/__lab/scale').then(r => r.ok ? r.json() : null).catch(() => null).then((info: { available?: boolean } | null) => {
    const ok = info?.available === true && !blocked;
    apply.disabled = !ok;
    if (info?.available !== true) {
      note.textContent = 'Applying needs the dev server (npm run dev). Use the command below, or ask Claude.';
    } else if (blocked) {
      note.textContent = "This scale doesn't fit, so it can't be applied.";
    }
  });

  apply.addEventListener('click', () => showActions(true));
  cancel.addEventListener('click', () => showActions(false));
  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    cancel.disabled = true;
    result.textContent = 'Applying…';
    try {
      const res = await fetch('/__lab/scale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scale: scaleId }) });
      const out = (await res.json()) as { error?: string; renamed?: number; versionFiles?: string[] };
      if (!res.ok) throw new Error(out.error ?? `The server said ${res.status}`);
      const label = SCALES.find(s => s.id === scaleId)?.label ?? scaleId;
      try {
        sessionStorage.setItem(SCALE_FLASH_KEY, `Applied ${label}: ${out.renamed} token${out.renamed === 1 ? '' : 's'} renamed, ${out.versionFiles?.length ?? 0} version file${out.versionFiles?.length === 1 ? '' : 's'} updated.`);
      } catch { /* storage can be blocked */ }
      result.textContent = 'Applied. Reloading…';
      // The dev server reloads the page when the files change; this is for when it does not.
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      result.textContent = `Could not apply: ${(e as Error).message}`;
      result.className = 'lab-scale-panel__summary--error';
      confirm.disabled = false;
      cancel.disabled = false;
    }
  });

  // The same change by hand.
  const command = `npm run tokens:scale -- --all ${scaleId}`;
  const pre = document.createElement('pre');
  pre.className = 'lab-css-pre';
  pre.id = 'scale-command';
  pre.textContent = command;
  const copy = document.createElement('button');
  copy.className = 'lab-btn lab-btn--sm';
  copy.id = 'scale-copy-btn';
  copy.textContent = 'Copy command';
  copy.addEventListener('click', () => { navigator.clipboard.writeText(command).catch(() => console.log(command)); });
  section.append(title, note, actions, result, pre, copy);
  return section;
}

