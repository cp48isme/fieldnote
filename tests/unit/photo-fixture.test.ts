/**
 * The synthetic photo fixture is what its generator says it is: a well-formed PNG of the
 * stated size, and the committed file is the generator's output. If someone replaces
 * the file with a photograph, the second assertion fails.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPng, FIXTURE } from "../../scripts/build-photo-fixture.mjs";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function dimensionsOf(png: Buffer): { width: number; height: number } {
  // IHDR is the first chunk: 8 signature bytes, 4 length, 4 type, then width and height.
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("the synthetic photo", () => {
  it("is a PNG of the stated size", () => {
    const png = buildPng(FIXTURE);
    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(dimensionsOf(png)).toEqual({ width: FIXTURE.width, height: FIXTURE.height });
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
  });

  it("is the committed fixture, byte for byte", () => {
    const committed = readFileSync(
      join(process.cwd(), "tests/fixtures/photo-synthetic.png"),
    );
    expect(committed.equals(buildPng(FIXTURE))).toBe(true);
  });

  it("builds a phone-sized image in memory at a size the suite can afford", () => {
    const png = buildPng({ width: 3024, height: 4032, initials: "PV" });
    expect(dimensionsOf(png)).toEqual({ width: 3024, height: 4032 });
    expect(png.length).toBeLessThan(200_000);
  });
});
