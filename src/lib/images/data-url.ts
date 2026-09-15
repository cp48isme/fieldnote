/**
 * Stored image bytes as a `data:` URL, for an `<img>`.
 *
 * Not an object URL: the Content Security Policy allows images from `self` and `data:`
 * and nothing else, and widening it to `blob:` for a thumbnail would be a change to a
 * header the suite asserts, made for convenience. A thumbnail is tens of kilobytes;
 * base64 of that is fine.
 */

export function dataUrlOf(bytes: ArrayBuffer, mediaType: string): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  // Chunked: `String.fromCharCode(...view)` overflows the argument limit on a large buffer.
  const CHUNK = 0x8000;
  for (let offset = 0; offset < view.length; offset += CHUNK) {
    binary += String.fromCharCode(...view.subarray(offset, offset + CHUNK));
  }
  return `data:${mediaType};base64,${btoa(binary)}`;
}
