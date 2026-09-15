/**
 * Images are resized on the device before storage, to a setting chosen for what they are.
 *
 * A photo: longest edge 512 pixels, JPEG — a phone camera produces a four-megabyte file
 * and a briefing needs a thumbnail. A site map (session 12): longest edge 1600 pixels,
 * PNG — a map with "north lot behind Building C" written on it is unreadable at 512, and
 * JPEG smears the text. The arithmetic and the sequencing are here, as a pure function
 * over a `DrawingSurface` — decode, draw at a size, encode — so the resize can be
 * unit-tested with a fake surface. The real surface is a canvas (`canvas-surface.ts`),
 * exercised end to end in a browser and nowhere else, because jsdom has no canvas and a
 * dependency bought to fake one is a dependency (ADR-0003's rule, applied to tests).
 *
 * Never upscaled: an image smaller than the limit is re-encoded at its own size.
 */

export interface ResizeSettings {
  maxEdge: number;
  mediaType: string;
  /** Encoder quality on a 0–1 scale; PNG ignores it. */
  quality: number;
}

/** A thumbnail of a face, not an archive. */
export const PHOTO_SETTINGS: ResizeSettings = {
  maxEdge: 512,
  mediaType: "image/jpeg",
  quality: 0.85,
};

/** Legible text on a map; PNG keeps its edges. */
export const SITE_MAP_SETTINGS: ResizeSettings = {
  maxEdge: 1600,
  mediaType: "image/png",
  quality: 1,
};

export const PHOTO_MAX_EDGE = PHOTO_SETTINGS.maxEdge;
export const PHOTO_MEDIA_TYPE = PHOTO_SETTINGS.mediaType;
export const PHOTO_QUALITY = PHOTO_SETTINGS.quality;

export interface Dimensions {
  width: number;
  height: number;
}

/** The size that fits `source` inside a square of `maxEdge`, keeping its aspect; never larger than `source`. */
export function fitWithin(source: Dimensions, maxEdge: number): Dimensions {
  const longest = Math.max(source.width, source.height);
  if (longest <= maxEdge) return { width: source.width, height: source.height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

/**
 * What a resize needs from the platform. `decode` turns a file into something `draw`
 * can render and reports its pixel size; `draw` renders it at a size and encodes the
 * result; `release` frees whatever `decode` held. The canvas implements all three; a
 * test fakes them.
 */
export interface DrawingSurface<Source = unknown> {
  decode(file: Blob): Promise<{ source: Source } & Dimensions>;
  draw(
    source: Source,
    size: Dimensions,
    mediaType: string,
    quality: number,
  ): Promise<ArrayBuffer>;
  release?(source: Source): void;
}

export interface ResizedPhoto extends Dimensions {
  bytes: ArrayBuffer;
  mediaType: string;
}

export class PhotoError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PhotoError";
  }
}

/** Decode, fit, draw, encode. Throws `PhotoError` when the file is not an image the surface can decode. */
export async function resizeImage<Source>(
  file: Blob,
  surface: DrawingSurface<Source>,
  settings: ResizeSettings,
): Promise<ResizedPhoto> {
  let decoded: { source: Source } & Dimensions;
  try {
    decoded = await surface.decode(file);
  } catch (cause) {
    throw new PhotoError("That file could not be read as an image.", { cause });
  }
  try {
    if (decoded.width < 1 || decoded.height < 1) {
      throw new PhotoError("That image has no pixels.");
    }
    const size = fitWithin(decoded, settings.maxEdge);
    const bytes = await surface.draw(
      decoded.source,
      size,
      settings.mediaType,
      settings.quality,
    );
    return { ...size, bytes, mediaType: settings.mediaType };
  } finally {
    surface.release?.(decoded.source);
  }
}

/** A photo, at the photo settings. */
export function resizePhoto<Source>(
  file: Blob,
  surface: DrawingSurface<Source>,
): Promise<ResizedPhoto> {
  return resizeImage(file, surface, PHOTO_SETTINGS);
}

/** A site map, at the map settings. */
export function resizeSiteMap<Source>(
  file: Blob,
  surface: DrawingSurface<Source>,
): Promise<ResizedPhoto> {
  return resizeImage(file, surface, SITE_MAP_SETTINGS);
}
