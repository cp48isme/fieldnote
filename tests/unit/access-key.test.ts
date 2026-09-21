/**
 * The caller key's hashing and comparison. ADR-0012.
 *
 * The constant-time assertion is on the function used, not on timing. A timing test would
 * measure the machine it runs on: it is flaky on a loaded CI runner and it passes on a
 * fast one whatever the code does. What can be asserted honestly is that the comparison
 * goes through `timingSafeEqual` rather than `===`, and that is what fails if someone
 * simplifies it.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

import { timingSafeEqual } from "node:crypto";

import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  configuredHashes,
  cookieValue,
  hashKey,
  keyMatches,
} from "@/lib/access/key";

const KEY = "fieldnote-unit-not-a-real-key";
/** SHA-256 of KEY, computed by the module under test rather than pasted. */
const hashOf = (value: string) => hashKey(value);

describe("hashKey", () => {
  it("is SHA-256, hex, and stable", async () => {
    const first = await hashKey(KEY);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashKey(KEY)).toBe(first);
    expect(await hashKey(`${KEY}x`)).not.toBe(first);
  });
});

describe("configuredHashes", () => {
  it("reads one hash, several, and tolerates commas and whitespace", async () => {
    const a = await hashOf("a");
    const b = await hashOf("b");
    expect(configuredHashes(a)).toEqual([a]);
    expect(configuredHashes(`${a},${b}`)).toEqual([a, b]);
    expect(configuredHashes(` ${a} \n ${b} `)).toEqual([a, b]);
    expect(configuredHashes(a.toUpperCase())).toEqual([a]);
  });

  it("is empty when unset or empty, which is what the routes refuse on", () => {
    expect(configuredHashes(undefined)).toEqual([]);
    expect(configuredHashes("")).toEqual([]);
    expect(configuredHashes("   ")).toEqual([]);
  });

  it("drops an entry that is not a SHA-256 digest rather than comparing it", async () => {
    const good = await hashOf("good");
    // `timingSafeEqual` throws on a length mismatch; a typo in configuration must not be
    // the thing that decides whether the route answers.
    expect(configuredHashes(`not-a-hash,${good},${"f".repeat(63)}`)).toEqual([good]);
  });
});

describe("keyMatches", () => {
  it("accepts the key behind the hash and rejects anything else", async () => {
    const hashes = [await hashOf(KEY)];
    expect(await keyMatches(KEY, hashes)).toBe(true);
    expect(await keyMatches(`${KEY} `, hashes)).toBe(false);
    expect(await keyMatches("wrong", hashes)).toBe(false);
  });

  it("accepts any of several devices' keys", async () => {
    const hashes = [await hashOf("device-one"), await hashOf("device-two")];
    expect(await keyMatches("device-one", hashes)).toBe(true);
    expect(await keyMatches("device-two", hashes)).toBe(true);
    expect(await keyMatches("device-three", hashes)).toBe(false);
  });

  it("refuses with no key and with no hashes configured", async () => {
    expect(await keyMatches(undefined, [await hashOf(KEY)])).toBe(false);
    expect(await keyMatches("", [await hashOf(KEY)])).toBe(false);
    expect(await keyMatches(KEY, [])).toBe(false);
  });

  it("compares through timingSafeEqual, not ===", async () => {
    // Counterfactual: replace `equalsInConstantTime` with `a === b` in
    // `src/lib/access/key.ts` and this fails.
    vi.mocked(timingSafeEqual).mockClear();
    await keyMatches(KEY, [await hashOf(KEY)]);
    expect(timingSafeEqual).toHaveBeenCalled();
  });

  it("compares every configured hash even after one matches", async () => {
    // Returning early on a match would leak which hash matched through timing.
    vi.mocked(timingSafeEqual).mockClear();
    const hashes = [await hashOf("one"), await hashOf("two"), await hashOf("three")];
    expect(await keyMatches("one", hashes)).toBe(true);
    expect(timingSafeEqual).toHaveBeenCalledTimes(3);
  });
});

describe("cookieValue", () => {
  it("finds the named cookie among others and decodes it", () => {
    expect(cookieValue("a=1; fieldnote_access=abc; b=2", "fieldnote_access")).toBe("abc");
    expect(cookieValue("fieldnote_access=a%20b", "fieldnote_access")).toBe("a b");
  });

  it("returns undefined for a missing cookie, a missing header, and a near miss", () => {
    expect(cookieValue(null, "fieldnote_access")).toBeUndefined();
    expect(cookieValue("other=1", "fieldnote_access")).toBeUndefined();
    // A prefix must not match: `x_fieldnote_access` is a different cookie.
    expect(cookieValue("x_fieldnote_access=abc", "fieldnote_access")).toBeUndefined();
  });
});

describe("the cookie's life", () => {
  it("is 90 days, the figure ADR-0012 states", () => {
    expect(ACCESS_COOKIE_MAX_AGE_SECONDS).toBe(90 * 24 * 60 * 60);
  });
});
