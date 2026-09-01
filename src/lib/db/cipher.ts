/**
 * The encryption seam.
 *
 * Per ADR-0004 the public build ships identity pass-throughs here. Session 19 replaces
 * `identityCipher` with real WebCrypto envelope encryption, in the private fork only,
 * and does not ship until it has a key-recovery story. Swapping this implementation is
 * the whole migration — which is the point of establishing the seam now, while the
 * schema is being written and it is nearly free.
 *
 * ADR-0004 also notes that pass-through hooks are dead code until then, and dead code
 * rots. `tests/unit/cipher.test.ts` asserts round-trip fidelity so the seam is
 * exercised rather than merely present.
 */

import { POLICIES_BY_TABLE, type TableName } from "./schema";

export interface FieldCipher {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

/**
 * The public build's cipher. Deliberately does nothing.
 *
 * Not "encryption that happens to be weak" — no key is involved and none is implied.
 * ADR-0004 rejects a key stored beside the ciphertext precisely because it would look
 * like a control while defending against nothing; an obvious no-op is more honest than
 * a reversible transform that reads as one.
 */
export const identityCipher: FieldCipher = {
  encrypt: (plaintext) => plaintext,
  decrypt: (ciphertext) => ciphertext,
};

let activeCipher: FieldCipher = identityCipher;

/** Session 19's entry point, and how tests substitute a real transform. */
export function setCipher(cipher: FieldCipher): void {
  activeCipher = cipher;
}

export function getCipher(): FieldCipher {
  return activeCipher;
}

export function resetCipher(): void {
  activeCipher = identityCipher;
}

/**
 * Only string values are transformed.
 *
 * A real cipher produces a string, so an eligible field holding a number or an array
 * could not round-trip through it without a serialization format this build has no
 * reason to choose yet. Every currently eligible field is a string; if a non-string one
 * is ever classified eligible, this throws rather than silently storing it in the clear.
 * A quiet pass-through here would be a control that reports success while doing nothing.
 */
function transformValue(
  value: unknown,
  direction: "encrypt" | "decrypt",
  table: TableName,
  field: string,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") {
    throw new TypeError(
      `Field ${table}.${field} is encryption-eligible but holds ${typeof value}. ` +
        `Eligible fields must be strings, or the cipher needs a serialization format ` +
        `(see cipher.ts). Refusing to store it unencrypted.`,
    );
  }
  const cipher = getCipher();
  return direction === "encrypt" ? cipher.encrypt(value) : cipher.decrypt(value);
}

function applyToRecord<T extends object>(
  table: TableName,
  record: T,
  direction: "encrypt" | "decrypt",
): T {
  const policies = POLICIES_BY_TABLE[table];
  // Spreading an interface into a string-keyed bag: the runtime shape is exactly that,
  // but TypeScript will not widen an interface without an index signature, so the
  // conversion is stated once here rather than at every call site.
  const out = { ...record } as Record<string, unknown>;
  for (const [field, policy] of Object.entries(policies)) {
    if (policy.encryption !== "eligible") continue;
    if (!(field in out)) continue;
    out[field] = transformValue(out[field], direction, table, field);
  }
  // The mapped copy has the same keys and value types as T; TypeScript cannot see that
  // through the string-keyed loop above, so the assertion states what the loop preserves.
  return out as T;
}

/** Applied on the way into Dexie. */
export function encryptRecord<T extends object>(table: TableName, record: T): T {
  return applyToRecord(table, record, "encrypt");
}

/** Applied on the way out of Dexie. */
export function decryptRecord<T extends object>(table: TableName, record: T): T {
  return applyToRecord(table, record, "decrypt");
}

export function decryptAll<T extends object>(table: TableName, records: T[]): T[] {
  return records.map((record) => decryptRecord(table, record));
}
