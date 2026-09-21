/**
 * The caller key: hashing, and the constant-time comparison the two routes share.
 *
 * ADR-0012. Before the application is served from a hosted origin the generation route
 * needs to know who is calling it, and `SECURITY.md` says there are no accounts. A
 * per-device key is the smallest thing that answers "who may call this route" without
 * introducing one.
 *
 * WHAT THE SERVER HOLDS IS HASHES, NEVER KEYS. `FIELDNOTE_ACCESS_KEY_HASHES` carries one
 * or more SHA-256 hashes, hex, separated by commas or whitespace. The key itself exists
 * in two places: the representative's device, in a cookie, and wherever the owner wrote
 * it down when `scripts/generate-access-key.mjs` printed it. A hash in an environment
 * variable that someone reads gets them nothing.
 *
 * WHY THE COMPARISON IS CONSTANT-TIME. The comparison is over hashes of a secret, and a
 * byte-by-byte comparison that returns early leaks, over many attempts, how much of a
 * guess was right. `timingSafeEqual` is the standard answer and
 * `tests/unit/access-key.test.ts` asserts it is the function used. Every configured hash
 * is compared even after one matches, for the same reason: returning early on the first
 * match would leak which hash matched through timing.
 *
 * WHAT THIS DOES NOT DO. It does not know about cookies, requests, or environments; it
 * takes strings and returns booleans, so both routes can use it and a test can call it
 * directly. Hashing is Web Crypto (`crypto.subtle`), which is global in the Node runtime
 * the routes run under, so no dependency was added for it.
 */

import * as nodeCrypto from "node:crypto";

/** The environment variable, named once. Both routes report it by this name and never print its value. */
export const ACCESS_KEY_HASHES_VARIABLE = "FIELDNOTE_ACCESS_KEY_HASHES";

/** The cookie the access route sets and the generation route reads. */
export const ACCESS_COOKIE = "fieldnote_access";

/**
 * How long a device stays authorised before the key must be entered again: 90 days.
 *
 * Long, deliberately. The failure this project exists to fix is friction in the field,
 * and a key prompt in a car park is friction. The cookie is not what protects a lost
 * device — full-disk encryption and automatic lock are (ADR-0004; `docs/THREAT-MODEL.md`
 * §5.6) — so a shorter life would cost the representative something real and buy little.
 */
export const ACCESS_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/** A SHA-256 hash as this module writes and reads it: 64 lower-case hex characters. */
const HASH_PATTERN = /^[0-9a-f]{64}$/;

/** SHA-256 of a UTF-8 string, hex. Web Crypto, so the same code runs in either runtime. */
export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The configured hashes, cleaned. Entries that are not a SHA-256 hex digest are dropped
 * rather than compared: `timingSafeEqual` throws on a length mismatch, and a malformed
 * entry is a typo in configuration, not a caller to reject differently.
 */
export function configuredHashes(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => HASH_PATTERN.test(entry));
}

/** True when `a` and `b` are the same string, compared in constant time. */
function equalsInConstantTime(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  // Called through the namespace rather than a named import so that the comparison is
  // observable: `tests/unit/access-key.test.ts` asserts this is the function used.
  return nodeCrypto.timingSafeEqual(left, right);
}

/**
 * Whether `key` hashes to one of `hashes`. False when there are no hashes, which is the
 * unconfigured case: the caller decides what to do about it, and both routes refuse.
 *
 * Every hash is compared even after a match, so the time taken does not say which one.
 */
export async function keyMatches(
  key: string | undefined,
  hashes: readonly string[],
): Promise<boolean> {
  if (!key || hashes.length === 0) return false;
  const presented = await hashKey(key);
  let matched = false;
  for (const hash of hashes) {
    if (equalsInConstantTime(presented, hash)) matched = true;
  }
  return matched;
}

/**
 * The value of one cookie from a `Cookie` header, or undefined.
 *
 * Written here rather than taken from `next/headers` so that both routes can be tested
 * with a plain `Request`, which is how `tests/unit/generate-route.test.ts` already builds
 * its cases.
 */
export function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}
