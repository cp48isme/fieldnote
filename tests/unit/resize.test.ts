/**
 * The photo resize, with a fake drawing surface: the fitted size, the no-upscale rule,
 * what the surface is asked to draw, and the errors.
 */

import { describe, expect, it, vi } from "vitest";

import {
  fitWithin,
  PHOTO_MAX_EDGE,
  PHOTO_MEDIA_TYPE,
  PHOTO_QUALITY,
  PhotoError,
  resizePhoto,
  type DrawingSurface,
} from "@/lib/images/resize";

function fakeSurface(width: number, height: number) {
  const draw = vi.fn(async (_source: string, size: { width: number; height: number }) => {
    // The "encoded" bytes are the drawn size, so the caller can check what was drawn.
    return new Uint8Array([
      size.width >> 8,
      size.width & 0xff,
      size.height >> 8,
      size.height & 0xff,
    ]).buffer;
  });
  const release = vi.fn();
  const surface: DrawingSurface<string> = {
    decode: async () => ({ source: "decoded", width, height }),
    draw,
    release,
  };
  return { surface, draw, release };
}

describe("fitWithin", () => {
  it("scales the longest edge to the limit and keeps the aspect", () => {
    expect(fitWithin({ width: 4032, height: 3024 }, 512)).toEqual({
      width: 512,
      height: 384,
    });
    expect(fitWithin({ width: 3024, height: 4032 }, 512)).toEqual({
      width: 384,
      height: 512,
    });
    expect(fitWithin({ width: 1000, height: 1000 }, 512)).toEqual({
      width: 512,
      height: 512,
    });
  });

  it("never upscales, and never rounds an edge to zero", () => {
    expect(fitWithin({ width: 300, height: 200 }, 512)).toEqual({
      width: 300,
      height: 200,
    });
    expect(fitWithin({ width: 512, height: 512 }, 512)).toEqual({
      width: 512,
      height: 512,
    });
    expect(fitWithin({ width: 10000, height: 1 }, 512)).toEqual({
      width: 512,
      height: 1,
    });
  });
});

describe("resizePhoto", () => {
  it("draws a phone photo at the fitted size as a JPEG and releases the decode", async () => {
    const { surface, draw, release } = fakeSurface(3024, 4032);
    const photo = await resizePhoto(new Blob(["x"]), surface);
    expect(photo).toMatchObject({ width: 384, height: 512, mediaType: PHOTO_MEDIA_TYPE });
    expect(draw).toHaveBeenCalledWith(
      "decoded",
      { width: 384, height: 512 },
      PHOTO_MEDIA_TYPE,
      PHOTO_QUALITY,
    );
    expect(new Uint8Array(photo.bytes)).toEqual(new Uint8Array([1, 128, 2, 0]));
    expect(release).toHaveBeenCalledWith("decoded");
    expect(PHOTO_MAX_EDGE).toBe(512);
  });

  it("re-encodes a small photo at its own size", async () => {
    const { surface, draw } = fakeSurface(300, 200);
    const photo = await resizePhoto(new Blob(["x"]), surface);
    expect(photo).toMatchObject({ width: 300, height: 200 });
    expect(draw.mock.calls[0]![1]).toEqual({ width: 300, height: 200 });
  });

  it("reports a file that is not an image, and releases nothing it never held", async () => {
    const release = vi.fn();
    const surface: DrawingSurface<string> = {
      decode: async () => {
        throw new Error("decode failed");
      },
      draw: async () => new ArrayBuffer(0),
      release,
    };
    await expect(resizePhoto(new Blob(["not an image"]), surface)).rejects.toThrow(
      PhotoError,
    );
    expect(release).not.toHaveBeenCalled();
  });

  it("refuses an image with no pixels", async () => {
    const { surface, release } = fakeSurface(0, 0);
    await expect(resizePhoto(new Blob(["x"]), surface)).rejects.toThrow(/no pixels/);
    expect(release).toHaveBeenCalled();
  });
});
