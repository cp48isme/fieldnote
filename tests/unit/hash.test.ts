/**
 * The audit hash against a published SHA-256 vector, so that a change of algorithm or
 * encoding cannot pass silently. What is hashed is the pipeline's decision and is tested
 * there; this is only that the function is what it says.
 */

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "@/lib/generation/hash";

describe("sha256Hex", () => {
  it("matches the FIPS 180-4 vector for 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashes the empty string to the known digest", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("agrees with Node's implementation on non-ASCII text, so the encoding is UTF-8", async () => {
    for (const text of [
      "é",
      "Dear [HCP_1], — thank you.",
      "Subject: ✔ confirmed\n\nBody",
    ]) {
      expect(await sha256Hex(text)).toBe(
        createHash("sha256").update(text, "utf8").digest("hex"),
      );
    }
  });
});
