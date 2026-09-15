#!/usr/bin/env node
/**
 * Builds the synthetic attendee photo, `tests/fixtures/photo-synthetic.png`: a flat
 * colour carrying the initials of a synthetic roster name. Run from the repository root
 * with `node scripts/build-photo-fixture.mjs`; the output is committed, and this script is
 * how it was made, so it can be remade — the same rule as the roster fixture.
 *
 * WHY A SCRIPT AND NOT A PHOTOGRAPH. A photograph is a photograph of someone. This
 * repository's rule is that no real person appears anywhere in it (ADR-0001), and a
 * generated image is the only kind that can be shown to satisfy it.
 *
 * WHY NO LIBRARY. A PNG is a signature, three chunks, and a CRC; the pixel rows are
 * deflated with `node:zlib`. Forty lines, nothing from `node_modules`, and the same
 * function builds a phone-sized image in memory for the end-to-end suite — a flat
 * colour deflates to a few kilobytes however many pixels it has, so a twelve-megapixel
 * upload can be exercised without committing twelve megapixels.
 *
 * The glyphs are a five-by-seven capital alphabet. The initials are drawn in the middle
 * at a size that makes them legible in a thumbnail.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
  Y: ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * A PNG of `width` by `height`, RGB, filled with `fill` and carrying `initials` in
 * `ink`, centred. Returns the file bytes.
 *
 * @param {{ width: number; height: number; fill?: [number, number, number]; ink?: [number, number, number]; initials?: string }} options
 * @returns {Buffer}
 */
export function buildPng({
  width,
  height,
  fill = [92, 116, 140],
  ink = [245, 245, 240],
  initials = "",
}) {
  const letters = [...initials.toUpperCase()].filter((l) => l in FONT);
  // Glyphs are 5 wide with a 1-column gap; scale so the initials fill about half the width.
  const columns = letters.length * 6 - 1;
  const scale = letters.length ? Math.max(1, Math.floor((width * 0.5) / columns)) : 0;
  const textWidth = columns * scale;
  const textHeight = 7 * scale;
  const left = Math.floor((width - textWidth) / 2);
  const top = Math.floor((height - textHeight) / 2);

  const inkAt = (x, y) => {
    if (!scale || x < left || y < top || x >= left + textWidth || y >= top + textHeight) {
      return false;
    }
    const column = Math.floor((x - left) / scale);
    const row = Math.floor((y - top) / scale);
    const index = Math.floor(column / 6);
    const within = column % 6;
    if (within === 5) return false;
    return FONT[letters[index]][row][within] === "1";
  };

  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  const fillRow = Buffer.alloc(stride);
  fillRow[0] = 0;
  for (let x = 0; x < width; x += 1) fillRow.set(fill, 1 + x * 3);
  for (let y = 0; y < height; y += 1) {
    fillRow.copy(raw, y * stride);
    if (scale && y >= top && y < top + textHeight) {
      for (let x = left; x < left + textWidth; x += 1) {
        if (inkAt(x, y)) raw.set(ink, y * stride + 1 + x * 3);
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The committed fixture: a portrait, larger than a thumbnail, with the synthetic initials "PV". */
export const FIXTURE = { width: 960, height: 1280, initials: "PV" };

// Run from the repository root. No `import.meta` here: the end-to-end suite imports this
// module through a transpiler that treats it as CommonJS.
if (process.argv[1] && basename(process.argv[1]) === "build-photo-fixture.mjs") {
  const out = join(process.cwd(), "tests", "fixtures", "photo-synthetic.png");
  writeFileSync(out, buildPng(FIXTURE));
  console.log(`wrote ${out}`);
}
