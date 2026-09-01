/**
 * Migration registry.
 *
 * CLAUDE.md requires a migration and a version bump for any schema change, so the
 * mechanism exists from v1 rather than being introduced when it is first needed. Adding
 * a version means appending an entry here; nothing else changes.
 *
 * `stores` is a full Dexie store declaration for that version, not a delta — Dexie
 * diffs consecutive versions itself. `upgrade` runs inside Dexie's upgrade transaction
 * and is where records are rewritten.
 *
 * This file is inside the data-access layer, so importing Dexie types here is allowed
 * by the boundary rule (see `tests/unit/db-boundary.test.ts`).
 */

import type { Transaction } from "dexie";

import { TABLES } from "./schema";

export interface Migration {
  version: number;
  /** Full store declaration at this version. Keys are table names. */
  stores: Record<string, string>;
  /** Optional data rewrite, run inside Dexie's upgrade transaction. */
  upgrade?: (tx: Transaction) => Promise<void> | void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    stores: {
      // Only indexed fields are declared. Everything else is stored but not indexed,
      // which matters here: encryption-eligible fields must never become index keys,
      // because an index over ciphertext is useless and an index over plaintext would
      // defeat the seam ADR-0004 exists to establish.
      [TABLES.events]: "id, status, startsAt, updatedAt",
      [TABLES.attendees]: "id, eventId, updatedAt",
      [TABLES.notes]: "id, eventId, attendeeId, updatedAt",
      [TABLES.drafts]: "id, eventId, attendeeId, state, updatedAt",
      [TABLES.auditRecords]: "id, draftId, eventId, createdAt",
      [TABLES.voiceProfiles]: "id, updatedAt",
      [TABLES.approvedContent]: "id, updatedAt",
      [TABLES.settings]: "id",
      [TABLES.sessionMarkers]: "id, startedAt, endedAt",
    },
  },
];

/**
 * The version records are stamped with on write. Derived from the registry so the two
 * cannot disagree; `schema.ts` exports the same number as a constant for consumers that
 * should not import the migration machinery.
 */
export const LATEST_MIGRATION_VERSION: number = MIGRATIONS.reduce(
  (max, migration) => Math.max(max, migration.version),
  0,
);
