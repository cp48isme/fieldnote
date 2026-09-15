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

import { POLICIES_BY_TABLE, type FieldShape, type TableName } from "./schema";

/**
 * Two shapes, one seam. Strings since session 2; bytes since session 11, for images,
 * which are stored as `ArrayBuffer` with a sibling media type and never as a `Blob` — a
 * real cipher emits bytes, so the stored type and the emitted type are the same, and
 * nothing depends on a `Blob` surviving IndexedDB on Safari. A field's policy declares
 * which shape it holds (`FieldPolicy.shape`), and the transform below refuses a value of
 * the other shape in either direction.
 */
export interface FieldCipher {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
  encryptBytes(plaintext: ArrayBuffer): ArrayBuffer;
  decryptBytes(ciphertext: ArrayBuffer): ArrayBuffer;
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
  encryptBytes: (plaintext) => plaintext,
  decryptBytes: (ciphertext) => ciphertext,
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
 * Only a value of the field's declared shape is transformed.
 *
 * A string cipher produces a string and a bytes cipher produces bytes, so an eligible
 * field holding anything else — a number, an array, a string where bytes were declared
 * or bytes where a string was — could not round-trip through it. If that ever happens,
 * this throws rather than silently storing the value in the clear, in either direction:
 * a quiet pass-through here would be a control that reports success while doing nothing.
 */
function transformValue(
  value: unknown,
  direction: "encrypt" | "decrypt",
  shape: FieldShape,
  table: TableName,
  field: string,
): unknown {
  if (value === null || value === undefined) return value;
  const cipher = getCipher();
  if (shape === "bytes") {
    if (!(value instanceof ArrayBuffer)) {
      throw new TypeError(
        `Field ${table}.${field} is encryption-eligible with shape bytes but holds ` +
          `${describe(value)}. Bytes fields must be an ArrayBuffer (see cipher.ts). ` +
          `Refusing to store it unencrypted.`,
      );
    }
    return direction === "encrypt"
      ? cipher.encryptBytes(value)
      : cipher.decryptBytes(value);
  }
  if (typeof value !== "string") {
    throw new TypeError(
      `Field ${table}.${field} is encryption-eligible but holds ${describe(value)}. ` +
        `Eligible fields must be strings, or declare shape bytes and hold an ArrayBuffer ` +
        `(see cipher.ts). Refusing to store it unencrypted.`,
    );
  }
  return direction === "encrypt" ? cipher.encrypt(value) : cipher.decrypt(value);
}

function describe(value: unknown): string {
  if (value instanceof ArrayBuffer) return "an ArrayBuffer";
  if (ArrayBuffer.isView(value)) return `a ${value.constructor.name}`;
  return typeof value;
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
    out[field] = transformValue(
      out[field],
      direction,
      policy.shape ?? "string",
      table,
      field,
    );
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
