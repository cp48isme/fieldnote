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

import {
  TABLES,
  type AuditRecordRecord,
  type DraftBlockReason,
  type DraftRecord,
} from "./schema";

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
  {
    // Session 6: drafts persist beside their audit records. The draft gains the text
    // as generated, its guardrail flags, and a blocked reason; the audit record gains the
    // blocked reason, the two review-gate timestamps, and nullable hashes and
    // human-edited fields. No index changes: nothing new is queried on.
    version: 2,
    stores: {
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
    upgrade: async (tx) => {
      // No v1 build ever wrote a draft or an audit record — session 5 held drafts in
      // memory precisely so none could exist without the other — so in practice these
      // loops rewrite nothing. They are here because CLAUDE.md requires a migration for
      // a schema change, and because a v1 store that somehow holds rows must still open.
      await tx
        .table(TABLES.drafts)
        .toCollection()
        .modify((draft: Partial<DraftRecord> & { body?: string }) => {
          draft.generatedBody ??= draft.body ?? "";
          draft.blocked ??= null;
          draft.flagsFired ??= [];
          draft.schemaVersion = 2;
        });
      await tx
        .table(TABLES.auditRecords)
        .toCollection()
        .modify((record: Partial<AuditRecordRecord>) => {
          record.inputHash ??= null;
          record.outputHash ??= null;
          record.blocked ??= null as DraftBlockReason | null;
          record.reviewedAt ??= null;
          record.exportedAt ??= null;
          // v1 wrote `humanEdited: false` for a record whose draft was never exported;
          // v2 says null until export, so a false with no distance was "not yet".
          if (record.editDistance === null || record.editDistance === undefined) {
            record.humanEdited = null;
            record.editDistance = null;
          }
          record.schemaVersion = 2;
        });
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
