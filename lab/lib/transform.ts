// A CSS transform string as the independent properties a runtime animates: Motion wants x, y, scale
// and rotate, not translateX(48px) scale(0.9). Anything it cannot convert is listed, not dropped.

export interface TransformParts {
  /** Property → value: a number (px, unitless, degrees) or a string with a unit ("100%"). */
  props: Record<string, number | string>;
  unsupported: string[];
}

// What a property is when nothing is applied: so two states can be compared prop for prop.
export const TRANSFORM_IDENTITY: Record<string, number> = { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0 };

export function transformParts(value: string): TransformParts {
  const props: Record<string, number | string> = {};
  const unsupported: string[] = [];
  if (value.trim() === 'none' || value.trim() === '') return { props, unsupported };
  const n = (v: string): number => parseFloat(v);
  const axis = (name: 'x' | 'y', v: string): void => { props[name] = v.endsWith('%') ? v : n(v); };
  for (const m of value.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const fn = m[1]!;
    const parts = m[2]!.split(',').map(s => s.trim());
    if (fn === 'translateX') axis('x', parts[0]!);
    else if (fn === 'translateY') axis('y', parts[0]!);
    else if (fn === 'translate') { axis('x', parts[0]!); axis('y', parts[1] ?? '0'); }
    else if (fn === 'scale' && parts[1] === undefined) props['scale'] = n(parts[0]!);
    else if (fn === 'scale') { props['scaleX'] = n(parts[0]!); props['scaleY'] = n(parts[1]!); }
    else if (fn === 'scaleX' || fn === 'scaleY') props[fn] = n(parts[0]!);
    else if (fn === 'rotate') props['rotate'] = n(parts[0]!);
    else unsupported.push(`${fn}(${parts.join(', ')})`);
  }
  return { props, unsupported };
}
