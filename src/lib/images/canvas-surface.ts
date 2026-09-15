/**
 * The real `DrawingSurface`: `createImageBitmap` to decode, a `<canvas>` to draw and
 * encode.
 *
 * A bitmap rather than an `<img>` with an object URL, because the Content Security
 * Policy allows images from `self` and `data:` only and a `blob:` source is refused;
 * decoding from the file directly involves no URL and no header. The bitmap API applies
 * the photo's EXIF orientation by default (`imageOrientation: "from-image"` is the
 * specified default), so a phone photo taken upright is drawn upright — on the browsers
 * the suite runs in. On the target phone this has not been observed; see the handoff.
 */

import type { DrawingSurface } from "./resize";

export function canvasSurface(): DrawingSurface<ImageBitmap> {
  return {
    async decode(file) {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    },
    async draw(source, size, mediaType, quality) {
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No 2D drawing context is available.");
      context.drawImage(source, 0, 0, size.width, size.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mediaType, quality),
      );
      if (!blob) throw new Error("The image could not be encoded.");
      return blob.arrayBuffer();
    },
    release(source) {
      source.close();
    },
  };
}
