#!/usr/bin/env node
//
// Generate a caller access key and its hash. ADR-0012.
// ====================================================
//
// Prints two things: a key, once, and the SHA-256 hash of it. The hash goes into
// FIELDNOTE_ACCESS_KEY_HASHES on the deployment; the key goes to the device, entered on
// the settings screen. One key per device, so revoking a device is removing its hash.
//
// THE KEY IS NEVER WRITTEN TO A FILE, and this script takes no argument that would make
// it. It goes to stdout once. If it is lost before it reaches the device, run this again
// and replace the hash: there is no recovery path and there should not be one, because a
// key this script could recover is a key stored somewhere it need not be.
//
// The hash is safe to paste anywhere the deployment's configuration lives. The key is not.
//
//   node scripts/generate-access-key.mjs
//
// 32 random bytes, base64url: 256 bits from the platform's CSPRNG, in an alphabet that
// survives a copy-paste through a terminal, a password manager, and a phone keyboard
// without a character needing to be escaped.

import { randomBytes, createHash } from "node:crypto";

const KEY_BYTES = 32;
const VARIABLE = "FIELDNOTE_ACCESS_KEY_HASHES";

const key = randomBytes(KEY_BYTES).toString("base64url");
const hash = createHash("sha256").update(key, "utf8").digest("hex");

process.stdout.write(
  [
    "",
    "Access key — shown once, not stored anywhere by this script.",
    "Enter it on the device, on the settings screen. Then close this terminal.",
    "",
    `  ${key}`,
    "",
    `Hash — put this in ${VARIABLE} on the deployment, Production environment only.`,
    "Several devices: separate their hashes with commas.",
    "",
    `  ${hash}`,
    "",
  ].join("\n"),
);
