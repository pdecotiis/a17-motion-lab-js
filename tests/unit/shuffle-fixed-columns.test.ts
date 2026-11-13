import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { COLUMNS, CELLS, boxOf, isColour, overlapsBetween } from '../../components/card-routing-shuffle/layouts';
import { FIXED_LAYOUTS, FIXED_ORDER, FIXED_PICTURE_OF, CARD_LABEL, CELL_PHOTOS, COLUMN_LABELS } from '../../components/card-routing-shuffle/layouts-fixed';
import { versions } from '../../components/card-routing-shuffle/motion';
import { validateVersionMeta } from '../../lab/lib/version-meta';

// v8: the columns keep their identity; what is inside changes.
describe('the fixed-column bento (v8)', () => {
  const markup = readFileSync('components/card-routing-shuffle/markup.html', 'utf8');
  it('has four arrangements (the four bullets) and valid version meta', () => {
    expect(FIXED_ORDER).toHaveLength(4);
    expect(() => validateVersionMeta(versions)).not.toThrow();
    expect(versions.find(v => v.id === 'v8')!.forkedFrom).toBe('v6');
  });
  it('every arrangement fills the grid: three rows to a column, no cell over two rows, the last cell ends at the bottom', () => {
    for (const [name, layout] of Object.entries(FIXED_LAYOUTS)) {
      for (const id of Object.keys(layout)) expect(CELLS, id).toContain(id);
      for (const col of COLUMNS) {
        expect(col.reduce((n, id) => n + (layout[id] ?? 0), 0), `${name} ${col.join()}`).toBe(3);
        const shown = col.map(id => boxOf(layout, id)).filter(b => b.h > 0), last = shown[shown.length - 1]!;
        expect(last.y + last.h).toBe(712);
        for (let i = 1; i < shown.length; i++) expect(shown[i]!.y, name).toBe(shown[i - 1]!.y + shown[i - 1]!.h + 8);   // no overlap, an 8px gap
      }
      for (const id of CELLS) expect(layout[id] ?? 0).toBeLessThanOrEqual(2);
    }
  });
  it('each column keeps its card: one card in every arrangement, always carrying the column\'s label', () => {
    for (const [name, layout] of Object.entries(FIXED_LAYOUTS)) COLUMNS.forEach((col, c) => {
      const cards = col.filter(id => isColour(id) && (layout[id] ?? 0) > 0);
      expect(cards, `${name} column ${c}`).toHaveLength(1);
      expect(CARD_LABEL[cards[0]!], `${name} ${cards[0]}`).toBe(COLUMN_LABELS[c]);
    });
  });
  it('the labels agree with the markup', () => {
    for (const [id, label] of Object.entries(CARD_LABEL)) expect(markup).toContain(`data-motion="title-${id}">${label}<`);
  });
  it('the first arrangement is the opening\'s: a card on top, at the bottom, on top', () => {
    const f = FIXED_LAYOUTS['arrangement-1']!;
    expect([f.o0, f.p0a, f.p1a, f.y1, f.g2, f.p2a]).toEqual([1, 2, 2, 1, 1, 2]);
  });
  it('the last arrangement loops to the first: nothing overlaps on the way, and every arrangement to the next', () => {
    FIXED_ORDER.forEach((name, k) => expect(overlapsBetween(FIXED_LAYOUTS[name]!, FIXED_LAYOUTS[FIXED_ORDER[(k + 1) % 4]!]!), name).toEqual([]));
  });
  it('every arrangement differs from the one before in what is inside its columns', () => {
    FIXED_ORDER.forEach((name, k) => expect(JSON.stringify(FIXED_LAYOUTS[name]), name).not.toBe(JSON.stringify(FIXED_LAYOUTS[FIXED_ORDER[(k + 1) % 4]!])));
  });
  it('the pictures: each cell shows one of its own, none twice, none shared with a neighbouring arrangement (round the loop)', () => {
    FIXED_ORDER.forEach((name, k) => {
      const pics = Object.values(FIXED_PICTURE_OF[name]!), next = Object.values(FIXED_PICTURE_OF[FIXED_ORDER[(k + 1) % 4]!]!);
      expect(Object.keys(FIXED_PICTURE_OF[name]!).sort(), name).toEqual(Object.keys(CELL_PHOTOS).filter(c => (FIXED_LAYOUTS[name]![c] ?? 0) > 0).sort());
      expect(new Set(pics).size).toBe(pics.length);
      expect(pics.filter(p => next.includes(p)), `${name} -> next`).toEqual([]);
      for (const [cell, p] of Object.entries(FIXED_PICTURE_OF[name]!)) expect(CELL_PHOTOS[cell]).toContain(Number(/\d+/.exec(p)![0]));
    });
  });
  it('CELL_PHOTOS matches the markup\'s image elements', () => {
    for (const [cell, photos] of Object.entries(CELL_PHOTOS)) photos.forEach((n, i) => expect(markup).toContain(`src="assets/photo-${n}.jpg" alt="" decoding="sync" data-motion="pic-${cell}-${i + 1}"`));
  });
});
