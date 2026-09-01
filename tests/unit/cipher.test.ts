/**
 * Round-trip tests for the encryption seam.
 *
 * ADR-0004 requires these explicitly: the pass-through hooks are dead code until
 * session 19, and dead code rots. Testing the seam with a *real* transform as well as
 * the identity one is what proves it is wired correctly — an identity-only test passes
 * just as happily when the cipher is never called at all.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  decryptRecord,
  encryptRecord,
  getCipher,
  identityCipher,
  resetCipher,
  setCipher,
  TABLES,
  eligibleFields,
  type FieldCipher,
  type NoteRecord,
} from "@/lib/db";

/** Not cryptography. A visible, reversible transform, so a skipped call is detectable. */
const reversingCipher: FieldCipher = {
  encrypt: (plaintext) => `enc:${[...plaintext].reverse().join("")}`,
  decrypt: (ciphertext) => {
    if (!ciphertext.startsWith("enc:")) {
      throw new Error(
        `decrypt called on something that was never encrypted: ${ciphertext}`,
      );
    }
    return [...ciphertext.slice(4)].reverse().join("");
  },
};

function sampleNote(): NoteRecord {
  return {
    id: "note-1",
    eventId: "event-1",
    attendeeId: null,
    // Synthetic throughout, per ADR-0001.
    body: "Asked whether the cabinet fits through a standard theatre door.",
    source: "typed",
    createdAt: 1,
    updatedAt: 2,
    schemaVersion: 1,
  };
}

afterEach(() => {
  resetCipher();
});

describe("cipher seam", () => {
  it("defaults to the identity cipher", () => {
    expect(getCipher()).toBe(identityCipher);
  });

  it("round-trips a record through the identity cipher unchanged", () => {
    const note = sampleNote();
    const restored = decryptRecord(TABLES.notes, encryptRecord(TABLES.notes, note));
    expect(restored).toEqual(note);
  });

  it("round-trips a record through a real transform", () => {
    setCipher(reversingCipher);
    const note = sampleNote();
    const encrypted = encryptRecord(TABLES.notes, note);

    // The eligible field actually changed — proving the hook is invoked.
    expect(encrypted.body).not.toBe(note.body);
    expect(encrypted.body.startsWith("enc:")).toBe(true);

    const restored = decryptRecord(TABLES.notes, encrypted);
    expect(restored).toEqual(note);
  });

  it("transforms only encryption-eligible fields", () => {
    setCipher(reversingCipher);
    const note = sampleNote();
    const encrypted = encryptRecord(TABLES.notes, note);

    // Clear fields are untouched, so indexes and the migration machinery still work.
    expect(encrypted.id).toBe(note.id);
    expect(encrypted.eventId).toBe(note.eventId);
    expect(encrypted.source).toBe(note.source);
    expect(encrypted.schemaVersion).toBe(note.schemaVersion);
    expect(encrypted.updatedAt).toBe(note.updatedAt);
  });

  it("leaves null eligible fields as null rather than encrypting the string 'null'", () => {
    setCipher(reversingCipher);
    const record = { ...sampleNote(), attendeeId: null };
    const encrypted = encryptRecord(TABLES.notes, record);
    expect(encrypted.attendeeId).toBeNull();
  });

  it("refuses to store a non-string eligible field rather than silently passing it through", () => {
    setCipher(reversingCipher);
    // `body` is eligible; a number cannot round-trip through a string cipher. Storing it
    // unencrypted would be a control reporting success while doing nothing.
    const malformed = { ...sampleNote(), body: 42 } as unknown as NoteRecord;
    expect(() => encryptRecord(TABLES.notes, malformed)).toThrow(/must be strings/);
  });

  it("classifies note body as eligible and note ids as clear", () => {
    const eligible = eligibleFields(TABLES.notes);
    expect(eligible).toContain("body");
    expect(eligible).not.toContain("id");
    expect(eligible).not.toContain("eventId");
    expect(eligible).not.toContain("attendeeId");
  });
});
