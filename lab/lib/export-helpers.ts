// Small pieces shared by the code exports (export-code.ts for Motion, gsap-code.ts for GSAP).
export const pascal = (s: string): string => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(w => w[0]!.toUpperCase() + w.slice(1)).join('');
export const camel = (s: string): string => s.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
export const num = (n: number): string => String(Math.round(n * 10000) / 10000);
export const seconds = (ms: number): string => num(ms / 1000);
export const str = (s: string): string => JSON.stringify(s);

export function parseMs(value: string | undefined, raw: Record<string, unknown>): number {
  const v = value !== undefined && value in raw ? raw[value] : value;
  if (typeof v !== 'string') return 0;
  return v.endsWith('ms') ? parseFloat(v) : v.endsWith('s') ? parseFloat(v) * 1000 : parseFloat(v);
}


// One keyframe as GSAP properties. GSAP wants x, y, scale and rotation, not a transform string, so
// translate/scale/rotate functions are converted; anything else is listed as unsupported.
export function gsapProps(kf: Keyframe): { props: [string, string][]; unsupported: string[] } {
  const props: [string, string][] = [];
  const unsupported: string[] = [];
  const n = (v: string): number => parseFloat(v);
  for (const [key, value] of Object.entries(kf)) {
    if (['offset', 'easing', 'composite'].includes(key)) continue;
    if (key === 'transform' && typeof value === 'string') {
      if (value.trim() === 'none') continue;
      for (const m of value.matchAll(/(\w+)\(([^)]*)\)/g)) {
        const fn = m[1]!;
        const parts = m[2]!.split(',').map(s => s.trim());
        const axis = (name: 'x' | 'y', v: string): void => { props.push(v.endsWith('%') ? [`${name}Percent`, num(n(v))] : [name, num(n(v))]); };
        if (fn === 'translateX') axis('x', parts[0]!);
        else if (fn === 'translateY') axis('y', parts[0]!);
        else if (fn === 'translate') { axis('x', parts[0]!); axis('y', parts[1] ?? '0'); }
        else if (fn === 'scale' && parts[1] === undefined) props.push(['scale', num(n(parts[0]!))]);
        else if (fn === 'scale') props.push(['scaleX', num(n(parts[0]!))], ['scaleY', num(n(parts[1]!))]);
        else if (fn === 'scaleX' || fn === 'scaleY') props.push([fn, num(n(parts[0]!))]);
        else if (fn === 'rotate') props.push(['rotation', num(n(parts[0]!))]);
        else unsupported.push(`${fn}(${parts.join(', ')})`);
      }
    } else if (key === 'opacity') {
      props.push(['opacity', String(value)]);
    } else {
      props.push([camel(key), str(String(value))]);
    }
  }
  return { props, unsupported };
}

export const obj = (props: [string, string][], extra: [string, string][] = []): string =>
  `{ ${[...props, ...extra].map(([k, v]) => `${/^[a-zA-Z_]\w*$/.test(k) ? k : str(k)}: ${v}`).join(', ')} }`;

export const GSAP_KEYWORDS: Record<string, string> = { linear: 'none', 'ease-in': 'power1.in', 'ease-out': 'power1.out', 'ease-in-out': 'power1.inOut' };

// Easings the code registers with CustomEase, by name, and the GSAP ease name for one easing value.
export class EaseRegistry {
  readonly entries = new Map<string, { bezier: string; comment: string }>();
  constructor(private raw: Record<string, unknown>) {}
  nameOf(easing: string): string {
    if (easing in GSAP_KEYWORDS) return GSAP_KEYWORDS[easing]!;
    let bezier: string | undefined;
    let name: string;
    const token = this.raw[easing];
    if (Array.isArray(token) && token.length === 4) {
      bezier = token.join(', ');
      name = easing.slice(easing.indexOf('.') + 1);
    } else {
      const m = /^cubic-bezier\(\s*([^)]+)\)$/.exec(easing);
      bezier = m ? m[1]!.split(',').map(s => s.trim()).join(', ') : easing === 'ease' ? '0.25, 0.1, 0.25, 1' : undefined;
      name = easing === 'ease' ? 'ease' : `custom-${this.entries.size + 1}`;
    }
    if (bezier === undefined) return 'none';
    this.entries.set(name, { bezier, comment: easing in this.raw ? easing : 'hard-coded, not a token' });
    return name;
  }
}

