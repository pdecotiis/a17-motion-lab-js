import { describe, it, expect } from 'vitest';
import { deflateSync, crc32 } from 'node:zlib';
import { formatBytes, isOpaquePng, rewriteNames } from '../../lab/lib/dist-optimize.js';

// A tiny PNG built by hand: width x height pixels of the given colour type (6 = RGBA, 2 = RGB), filter type 0 on every row.
function png(width: number, height: number, colorType: 6 | 2, pixel: (x: number, y: number) => number[], filter = 0): Buffer {
  const bpp = colorType === 6 ? 4 : 3;
  const rows: number[] = [];
  for (let y = 0; y < height; y++) { rows.push(filter); for (let x = 0; x < width; x++) rows.push(...pixel(x, y)); }
  const chunk = (type: string, data: Buffer): Buffer => {
    const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])) >>> 0, 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = colorType;
  void bpp;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from(rows))), chunk('IEND', Buffer.alloc(0))]);
}

describe('isOpaquePng', () => {
  it('is true for an RGBA picture whose every pixel is fully opaque (what exported photos are)', () => {
    expect(isOpaquePng(png(4, 3, 6, (x, y) => [x * 20, y * 30, 90, 255]))).toBe(true);
  });
  it('is false as soon as one pixel is see-through', () => {
    expect(isOpaquePng(png(4, 3, 6, (x, y) => [10, 20, 30, x === 2 && y === 1 ? 128 : 255]))).toBe(false);
  });
  it('is true for a PNG with no alpha channel', () => {
    expect(isOpaquePng(png(3, 3, 2, () => [1, 2, 3]))).toBe(true);
  });
  it('reads the row filters (a Sub-filtered row of opaque pixels is still opaque, and a transparent one is not)', () => {
    // filter 1 (Sub) stores each byte minus the byte one pixel to the left: an opaque row is the first pixel, then zeros
    const opaque = png(3, 1, 6, x => (x === 0 ? [5, 6, 7, 255] : [0, 0, 0, 0]), 1);
    expect(isOpaquePng(opaque)).toBe(true);
    const clear = png(3, 1, 6, x => (x === 0 ? [5, 6, 7, 255] : [0, 0, 0, 1]), 1); // the second pixel's alpha is 255 + 1 = 0 (mod 256) after unfiltering
    expect(isOpaquePng(clear)).toBe(false);
  });
  it('is false for something that is not a PNG', () => {
    expect(isOpaquePng(Buffer.from('not a picture at all, just some text'))).toBe(false);
  });
});

describe('rewriteNames', () => {
  it('replaces every mention of each renamed file', () => {
    const renames = new Map([['photo-ABC.png', 'photo-ABC.jpg']]);
    expect(rewriteNames('a("assets/photo-ABC.png"), b: url(photo-ABC.png) c', renames)).toBe('a("assets/photo-ABC.jpg"), b: url(photo-ABC.jpg) c');
    expect(rewriteNames('nothing here', renames)).toBe('nothing here');
  });
});

describe('formatBytes', () => {
  it('says KB below a megabyte and MB above', () => {
    expect(formatBytes(204800)).toBe('200 KB');
    expect(formatBytes(23 * 1024 * 1024)).toBe('23.0 MB');
  });
});
