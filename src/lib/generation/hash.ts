/**
 * The hash an audit record holds instead of content. Plan §4.4.
 *
 * SHA-256 over UTF-8, hex-encoded, through WebCrypto — available in every browser this
 * app runs in and in Node, so the same function serves the pipeline and its tests with no
 * dependency. What is hashed, and why, is decided in `pipeline.ts` and recorded in
 * ADR-0008: the request body as it crossed the boundary, and the guarded text before
 * rehydration, so that neither hash reconstructs only against text containing a name.
 */

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
