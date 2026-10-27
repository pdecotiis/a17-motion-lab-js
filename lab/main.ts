import tokensJson from '../tokens/motion.json';
import type { MotionVersion, PageConfig, MotionMap, LiveControls, ComponentModule, Preset, DtcgGroup } from './lib/types.js';
import { compileTokens, applyTokensToDom } from './lib/token-compiler.js';
import { registerComponent, getVersion, getDefaultVersion } from './lib/version-registry.js';
import { resolveTiming, buildAnimationOptions } from './lib/motion-models.js';
import { getMotionMapFromUrl, setMotionMapInUrl } from './lib/motion-map.js';
import { validatePreset } from './lib/presets.js';
import { prefersReducedMotion, getEffectiveDuration, getEffectiveKeyframes } from './lib/reduced-motion.js';

// ── Glob imports (bundled at build time, no runtime fetches) ───────────────

const markupModules = import.meta.glob<string>(
  '../components/*/markup.html',
  { query: '?raw', import: 'default', eager: true }
);

const motionModules = import.meta.glob<ComponentModule>(
  '../components/*/motion.ts',
  { import: 'default', eager: true }
);

const pageModules = import.meta.glob<PageConfig>(
  '../pages/*/page.json',
  { eager: true, import: 'default' }
);

const presetModules = import.meta.glob<Preset>(
  '../motion-maps/*.json',
  { eager: true, import: 'default' }
);

function getMarkup(componentName: string): string {
  const key = `../components/${componentName}/markup.html`;
  return markupModules[key] ?? '<div class="lab-error">Component markup not found</div>';
}

function getPageConfig(pageName: string): PageConfig | undefined {
  const key = `../pages/${pageName}/page.json`;
  return pageModules[key];
}

function getPresets(): Preset[] {
  return Object.values(presetModules)
    .map(p => { try { return validatePreset(p); } catch { return null; } })
    .filter((p): p is Preset => p !== null);
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

const { cssVars, raw } = compileTokens(tokensJson as unknown as DtcgGroup);
applyTokensToDom(cssVars);

// Register all components from glob
for (const [path, module] of Object.entries(motionModules)) {
  const name = path.match(/\/components\/([^/]+)\/motion\.ts$/)?.[1];
  if (name && module) registerComponent(name, module as ComponentModule);
}

// ── State ──────────────────────────────────────────────────────────────────

let playbackRate = 1;
let currentTheme: 'light' | 'dark' = 'light';
let activeAnimations: Animation[] = [];

// ── Reduced motion ─────────────────────────────────────────────────────────

const reducedMotion = prefersReducedMotion();
const notice = document.getElementById('reduced-motion-notice')!;
if (reducedMotion) notice.classList.remove('lab-notice--hidden');

// ── Theme ──────────────────────────────────────────────────────────────────

const themeToggle = document.getElementById('theme-toggle')!;
themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  themeToggle.textContent = currentTheme === 'dark' ? '☾' : '☀';
});

// ── Speed control ──────────────────────────────────────────────────────────

const speedControl = document.getElementById('speed-control') as HTMLSelectElement;
speedControl.addEventListener('change', () => {
  playbackRate = parseFloat(speedControl.value);
  activeAnimations.forEach(a => { a.playbackRate = playbackRate; });
});

// ── Nav ────────────────────────────────────────────────────────────────────

const navBtns = document.querySelectorAll<HTMLButtonElement>('.lab-nav__btn');
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset['view']!;
    const params = new URLSearchParams(window.location.search);
    params.set('view', view);
    window.location.search = params.toString();
  });
});

// ── Animation helpers ──────────────────────────────────────────────────────

function animateElement(
  el: HTMLElement,
  version: MotionVersion,
  controls: LiveControls = {},
  staggerIndex = 0
): Animation {
  const timing = resolveTiming(version, raw, controls, playbackRate);
  const isReduced = prefersReducedMotion();
  const effectiveDuration = getEffectiveDuration(timing.duration);
  const effectiveKeyframes = getEffectiveKeyframes(version.keyframes, isReduced);

  const staggerMs = version.stagger ? parseFloat(version.stagger) : 0;
  const staggerDelay = (staggerMs * staggerIndex) / playbackRate;

  const options = buildAnimationOptions({
    ...timing,
    duration: effectiveDuration,
    delay: timing.delay + staggerDelay,
  });

  el.getAnimations().forEach(a => a.cancel());
  const anim = el.animate(effectiveKeyframes, options);
  anim.playbackRate = playbackRate;
  return anim;
}

// ── Component view ─────────────────────────────────────────────────────────

function renderComponentView(params: URLSearchParams): void {
  const componentName = params.get('component') ?? 'card';
  const versionId = params.get('version') ?? 'v1';

  const main = document.getElementById('main-content')!;
  main.innerHTML = '';
  main.className = 'lab-main lab-main--component';

  const markup = getMarkup(componentName);

  main.innerHTML = `
    <div class="lab-component-layout">
      <div class="lab-preview-area">
        <div class="lab-preview" id="preview-primary">
          <div class="lab-preview__inner" id="preview-inner-primary"></div>
        </div>
        <div class="lab-compare" id="compare-area" hidden>
          <div class="lab-preview" id="preview-secondary">
            <div class="lab-preview__inner" id="preview-inner-secondary"></div>
          </div>
        </div>
      </div>
      <aside class="lab-sidebar">
        <section class="lab-controls" aria-label="Version controls">
          <h3 class="lab-controls__title">Version</h3>
          <div class="lab-version-tabs" id="version-tabs" role="tablist"></div>
          <button class="lab-btn" id="replay-btn">Replay</button>
        </section>
        <section class="lab-controls" aria-label="Live controls">
          <h3 class="lab-controls__title">Controls</h3>
          <div class="lab-control-group">
            <label class="lab-control-label" for="ctrl-duration">Duration (ms)</label>
            <input class="lab-input" type="number" id="ctrl-duration" min="0" max="5000" step="50" />
          </div>
          <div class="lab-control-group">
            <label class="lab-control-label" for="ctrl-easing">Easing</label>
            <select class="lab-select" id="ctrl-easing">
              <option value="">— token default —</option>
              <option value="ease">ease</option>
              <option value="ease-in">ease-in</option>
              <option value="ease-out">ease-out</option>
              <option value="ease-in-out">ease-in-out</option>
              <option value="linear">linear</option>
              <option value="__custom__">custom…</option>
            </select>
            <input class="lab-input lab-input--hidden" type="text" id="ctrl-easing-custom" placeholder="cubic-bezier(0,0,0.2,1)" />
          </div>
          <div class="lab-control-group">
            <label class="lab-control-label" for="ctrl-delay">Delay (ms)</label>
            <input class="lab-input" type="number" id="ctrl-delay" min="0" max="5000" step="10" />
          </div>
          <button class="lab-btn" id="copy-values-btn">Copy values</button>
        </section>
        <section class="lab-controls" aria-label="Compare">
          <h3 class="lab-controls__title">Compare with</h3>
          <select class="lab-select" id="compare-select">
            <option value="">None</option>
          </select>
        </section>
      </aside>
    </div>
  `;

  // Version tabs
  const versionTabs = document.getElementById('version-tabs')!;
  const mod = motionModules[`../components/${componentName}/motion.ts`];
  const allVersions: MotionVersion[] = mod?.versions ?? [];

  allVersions.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'lab-version-tab' + (v.id === versionId ? ' lab-version-tab--active' : '');
    btn.dataset['versionId'] = v.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', v.id === versionId ? 'true' : 'false');
    btn.textContent = `${v.id}: ${v.label}`;
    btn.addEventListener('click', () => {
      const sp = new URLSearchParams(window.location.search);
      sp.set('version', v.id);
      window.history.replaceState(null, '', `?${sp.toString()}`);
      renderComponentView(sp);
    });
    versionTabs.appendChild(btn);
  });

  // Compare select options
  const compareSelect = document.getElementById('compare-select') as HTMLSelectElement;
  allVersions.filter(v => v.id !== versionId).forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.id}: ${v.label}`;
    compareSelect.appendChild(opt);
  });

  // Render primary preview
  const primaryInner = document.getElementById('preview-inner-primary')!;
  primaryInner.innerHTML = markup;
  const primaryTarget =
    primaryInner.querySelector<HTMLElement>('[data-motion-target]') ??
    (primaryInner.firstElementChild as HTMLElement);

  let liveControls: LiveControls = {};

  function playAnimation(
    target: HTMLElement,
    vid: string,
    controls: LiveControls = {},
    staggerIdx = 0
  ): Animation {
    const version = getVersion(componentName, vid);
    const anim = animateElement(target, version, controls, staggerIdx);
    activeAnimations = activeAnimations.filter(a => a.playState !== 'finished').concat(anim);
    return anim;
  }

  playAnimation(primaryTarget, versionId, liveControls);

  document.getElementById('replay-btn')!.addEventListener('click', () => {
    playAnimation(primaryTarget, versionId, liveControls);
    const compareArea = document.getElementById('compare-area')!;
    if (!compareArea.hidden) {
      const secondaryInner = document.getElementById('preview-inner-secondary')!;
      const secondaryTarget =
        secondaryInner.querySelector<HTMLElement>('[data-motion-target]') ??
        (secondaryInner.firstElementChild as HTMLElement);
      const compareVid = compareSelect.value;
      if (compareVid) playAnimation(secondaryTarget, compareVid, {});
    }
  });

  // Live controls
  const durationInput = document.getElementById('ctrl-duration') as HTMLInputElement;
  const easingSelect = document.getElementById('ctrl-easing') as HTMLSelectElement;
  const easingCustom = document.getElementById('ctrl-easing-custom') as HTMLInputElement;
  const delayInput = document.getElementById('ctrl-delay') as HTMLInputElement;

  const version = getVersion(componentName, versionId);
  const resolved = resolveTiming(version, raw, {}, 1);
  durationInput.value = String(Math.round(resolved.duration));
  delayInput.value = String(Math.round(resolved.delay));

  function updateControls(): void {
    const easingVal =
      easingSelect.value === '__custom__' ? easingCustom.value : (easingSelect.value || undefined);
    liveControls = {
      duration: durationInput.value ? `${durationInput.value}ms` : undefined,
      easing: easingVal,
      delay: delayInput.value ? `${delayInput.value}ms` : undefined,
    };
    playAnimation(primaryTarget, versionId, liveControls);
  }

  durationInput.addEventListener('change', updateControls);
  easingSelect.addEventListener('change', () => {
    if (easingSelect.value === '__custom__') {
      easingCustom.classList.remove('lab-input--hidden');
    } else {
      easingCustom.classList.add('lab-input--hidden');
    }
    updateControls();
  });
  easingCustom.addEventListener('change', updateControls);
  delayInput.addEventListener('change', updateControls);

  document.getElementById('copy-values-btn')!.addEventListener('click', () => {
    const easing = liveControls.easing ?? resolved.easing;
    const duration = liveControls.duration ?? `${resolved.duration}ms`;
    const delay = liveControls.delay ?? `${resolved.delay}ms`;
    const json = JSON.stringify({ version: versionId, duration, easing, delay }, null, 2);
    navigator.clipboard.writeText(json).catch(() => {
      console.log('Copy values:', json);
    });
  });

  compareSelect.addEventListener('change', () => {
    const compareArea = document.getElementById('compare-area')!;
    const secondaryInner = document.getElementById('preview-inner-secondary')!;
    const compareVid = compareSelect.value;
    if (!compareVid) {
      compareArea.hidden = true;
      return;
    }
    compareArea.hidden = false;
    secondaryInner.innerHTML = markup;
    const secondaryTarget =
      secondaryInner.querySelector<HTMLElement>('[data-motion-target]') ??
      (secondaryInner.firstElementChild as HTMLElement);
    const pAnim = playAnimation(primaryTarget, versionId, liveControls);
    const sAnim = playAnimation(secondaryTarget, compareVid, {});
    pAnim.currentTime = 0;
    sAnim.currentTime = 0;
  });
}

// ── Page view ──────────────────────────────────────────────────────────────

function renderPageView(params: URLSearchParams): void {
  const pageName = params.get('page') ?? 'home';
  const main = document.getElementById('main-content')!;
  main.innerHTML = '';
  main.className = 'lab-main lab-main--page';

  const pageConfigMaybe = getPageConfig(pageName);
  if (!pageConfigMaybe) {
    main.innerHTML = `<p class="lab-error">Page "${pageName}" not found</p>`;
    return;
  }
  // Narrow to non-undefined for inner functions
  const pageConfig: PageConfig = pageConfigMaybe;

  let motionMap: MotionMap = getMotionMapFromUrl();
  if (Object.keys(motionMap).length === 0) {
    pageConfig.components.forEach(pc => {
      motionMap[pc.id] = getDefaultVersion(pc.component).id;
    });
  }

  const staggerMs = parseInt(params.get('stagger') ?? '80', 10);

  main.innerHTML = `
    <div class="lab-page-layout">
      <div class="lab-page-grid" id="page-grid"></div>
      <aside class="lab-sidebar">
        <section class="lab-controls" aria-label="Motion map">
          <h3 class="lab-controls__title">Motion Map</h3>
          <div id="motion-map-panel" class="lab-motion-map-panel"></div>
          <button class="lab-btn" id="replay-all-btn">Replay All</button>
        </section>
        <section class="lab-controls" aria-label="Stagger">
          <h3 class="lab-controls__title">Stagger</h3>
          <div class="lab-control-group">
            <label class="lab-control-label" for="stagger-input">Delay between (ms)</label>
            <input class="lab-input" type="number" id="stagger-input" min="0" max="500" step="10" value="${staggerMs}" />
          </div>
        </section>
        <section class="lab-controls" aria-label="Presets">
          <h3 class="lab-controls__title">Presets</h3>
          <button class="lab-btn" id="save-preset-btn">Save preset</button>
          <div id="preset-list" class="lab-preset-list"></div>
        </section>
      </aside>
    </div>
  `;

  const pageGrid = document.getElementById('page-grid')!;
  const motionMapPanel = document.getElementById('motion-map-panel')!;
  const componentAnims = new Map<string, Animation>();

  function renderComponents(currentStaggerMs: number): void {
    pageGrid.innerHTML = '';
    pageConfig.components.forEach((pc, i) => {
      const markup = getMarkup(pc.component);
      const wrapper = document.createElement('div');
      wrapper.className = `lab-page-item lab-page-item--${pc.layout ?? 'full'}`;
      wrapper.dataset['componentId'] = pc.id;
      wrapper.innerHTML = markup;
      pageGrid.appendChild(wrapper);

      const target =
        wrapper.querySelector<HTMLElement>('[data-motion-target]') ??
        (wrapper.firstElementChild as HTMLElement);
      const vid = motionMap[pc.id] ?? getDefaultVersion(pc.component).id;
      const ver = getVersion(pc.component, vid);
      const timing = resolveTiming(ver, raw, {}, playbackRate);

      target.getAnimations().forEach(a => a.cancel());
      const kf = getEffectiveKeyframes(ver.keyframes, reducedMotion);
      const opts = buildAnimationOptions({
        ...timing,
        duration: getEffectiveDuration(timing.duration),
        delay: timing.delay + (currentStaggerMs * i) / playbackRate,
      });
      const anim = target.animate(kf, opts);
      anim.playbackRate = playbackRate;
      componentAnims.set(pc.id, anim);
      activeAnimations.push(anim);
    });
  }

  function buildMotionMapPanel(): void {
    motionMapPanel.innerHTML = '';
    pageConfig.components.forEach(pc => {
      const group = document.createElement('div');
      group.className = 'lab-control-group';
      const label = document.createElement('label');
      label.className = 'lab-control-label';
      label.textContent = pc.id;
      const sel = document.createElement('select');
      sel.className = 'lab-select';
      sel.dataset['componentId'] = pc.id;

      const mod = motionModules[`../components/${pc.component}/motion.ts`];
      const versions: MotionVersion[] = mod?.versions ?? [];
      versions.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.id}: ${v.label}`;
        if (motionMap[pc.id] === v.id) opt.selected = true;
        sel.appendChild(opt);
      });

      sel.addEventListener('change', () => {
        motionMap[pc.id] = sel.value;
        setMotionMapInUrl(motionMap);
        const wrapper = pageGrid.querySelector<HTMLElement>(`[data-component-id="${pc.id}"]`);
        if (wrapper) {
          const target =
            wrapper.querySelector<HTMLElement>('[data-motion-target]') ??
            (wrapper.firstElementChild as HTMLElement);
          const ver = getVersion(pc.component, sel.value);
          const anim = animateElement(target, ver, {});
          componentAnims.set(pc.id, anim);
        }
      });

      group.appendChild(label);
      group.appendChild(sel);
      motionMapPanel.appendChild(group);
    });
  }

  renderComponents(staggerMs);
  buildMotionMapPanel();

  document.getElementById('replay-all-btn')!.addEventListener('click', () => {
    const currentStagger = parseInt(
      (document.getElementById('stagger-input') as HTMLInputElement).value,
      10
    );
    renderComponents(currentStagger);
  });

  document.getElementById('stagger-input')!.addEventListener('change', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    const sp = new URLSearchParams(window.location.search);
    sp.set('stagger', String(val));
    window.history.replaceState(null, '', `?${sp.toString()}`);
  });

  document.getElementById('save-preset-btn')!.addEventListener('click', () => {
    const label = prompt('Preset name:');
    if (!label) return;
    const preset = {
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      motionMap: { ...motionMap },
    };
    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${preset.id}.json`;
    a.click();
  });

  // Load preset list
  const presetList = document.getElementById('preset-list')!;
  getPresets().forEach(preset => {
    const btn = document.createElement('button');
    btn.className = 'lab-btn lab-btn--sm';
    btn.textContent = preset.label;
    btn.addEventListener('click', () => {
      motionMap = { ...preset.motionMap };
      setMotionMapInUrl(motionMap);
      buildMotionMapPanel();
      const currentStagger = parseInt(
        (document.getElementById('stagger-input') as HTMLInputElement).value,
        10
      );
      renderComponents(currentStagger);
    });
    presetList.appendChild(btn);
  });
}

// ── Router ─────────────────────────────────────────────────────────────────

function route(): void {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') ?? 'component';

  navBtns.forEach(btn => {
    const isActive = btn.dataset['view'] === view;
    btn.setAttribute('aria-pressed', String(isActive));
    btn.classList.toggle('lab-nav__btn--active', isActive);
  });

  if (view === 'page') {
    renderPageView(params);
  } else {
    renderComponentView(params);
  }
}

route();
