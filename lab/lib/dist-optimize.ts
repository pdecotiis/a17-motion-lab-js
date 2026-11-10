import { inflateSync } from 'node:zlib';

// Pure parts of `npm run build:small` (scripts/optimize-dist.ts), which shrinks a built copy for sharing: the big photos in dist/assets are recompressed
// (the lab's own code is a few hundred KB; a project's photos are nearly all of the size). Kept apart from the script so it can be tested.

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Whether a PNG is fully opaque, so it can become a JPEG without losing anything. A PNG with no alpha channel is; an 8-bit RGBA or grey+alpha one is when
 * every alpha value is 255 (a "has alpha" flag alone says nothing: exported photos carry it with nothing transparent in them). Anything this does not read
 * (interlaced, 16-bit, palette with transparency) is "not known to be opaque", and the file is left alone.
 */
export function isOpaquePng(png: Buffer): boolean {
  if (png.length < 33 || !png.subarray(0, 8).equals(SIGNATURE)) return false;
  let width = 0, height = 0, depth = 0, colorType = -1, interlace = 0;
  const idat: Buffer[] = [];
  let hasTrns = false;
  for (let pos = 8; pos + 8 <= png.length;) {
    const len = png.readUInt32BE(pos);
    const type = png.toString('latin1', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]!; colorType = data[9]!; interlace = data[12]!; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'tRNS') hasTrns = true;
    pos += 12 + len;
  }
  if (colorType === 0 || colorType === 2) return !hasTrns;            // grey or RGB: no alpha channel (a tRNS chunk would make a colour transparent)
  if (colorType === 3) return !hasTrns;                                // palette: opaque unless it has transparency
  if (depth !== 8 || interlace !== 0 || (colorType !== 4 && colorType !== 6)) return false;
  const bpp = colorType === 6 ? 4 : 2;                                 // bytes per pixel; the alpha byte is the last of each
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  if (raw.length < height * (stride + 1)) return false;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp]! : 0, b = prev[x]!, c = x >= bpp ? prev[x - bpp]! : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (filter !== 0) return false;
      line[x] = (line[x]! + add) & 255;
    }
    for (let x = bpp - 1; x < stride; x += bpp) if (line[x] !== 255) return false;
    prev = line;
  }
  return true;
}

/** Rewrites every mention of the given file names (hashed asset names are unique) in a text file's contents. */
export function rewriteNames(text: string, renames: ReadonlyMap<string, string>): string {
  let out = text;
  for (const [from, to] of renames) out = out.split(from).join(to);
  return out;
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}
