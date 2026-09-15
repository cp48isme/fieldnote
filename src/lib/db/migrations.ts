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
  type AttendeeRecord,
  type AuditRecordRecord,
  type DraftBlockReason,
  type DraftRecord,
  type EventRecord,
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
  {
    // Session 8: attendees carry where they came from. Every attendee written before
    // this version was typed into the dock at an event, so the backfill is `captured`;
    // `imported` exists only from v3 onward. No index changes: source is not queried on.
    version: 3,
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
      await tx
        .table(TABLES.attendees)
        .toCollection()
        .modify((attendee: Partial<AttendeeRecord>) => {
          attendee.source ??= "captured";
          attendee.schemaVersion = 3;
        });
    },
  },
  {
    // Session 10: the token class is a field, not a reading of `specialty`. The backfill
    // is the old heuristic, so nothing already stored changes class: a non-empty
    // specialty becomes `hcp`, anything else `staff`. From here the field is the truth
    // and `specialty` is just a specialty. No index changes.
    version: 4,
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
      await tx
        .table(TABLES.attendees)
        .toCollection()
        .modify((attendee: Partial<AttendeeRecord>) => {
          attendee.kind ??= (attendee.specialty ?? "").trim() ? "hcp" : "staff";
          attendee.schemaVersion = 4;
        });
    },
  },
  {
    // Session 9: the audit record says which approved passages a draft carried and
    // from which library. Every record written before this version was generated with
    // no library, so the backfill is an empty list and a null version. No index changes.
    version: 5,
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
      await tx
        .table(TABLES.auditRecords)
        .toCollection()
        .modify((record: Partial<AuditRecordRecord>) => {
          record.passagesUsed ??= [];
          record.libraryVersion ??= null;
          record.schemaVersion = 5;
        });
    },
  },
  {
    // Session 11: the briefing. The event gains its five dossier fields and the attendee
    // gains the representative's briefing notes, all empty until she writes them. Two
    // new tables: images, keyed by owner so an owner's images can be found and removed
    // with it, and contacts, keyed by event. Nothing existing is rewritten beyond the
    // backfill; no row is created.
    version: 6,
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
      [TABLES.images]: "id, ownerId",
      [TABLES.contacts]: "id, eventId, updatedAt",
    },
    upgrade: async (tx) => {
      await tx
        .table(TABLES.events)
        .toCollection()
        .modify((event: Partial<EventRecord>) => {
          event.objectives ??= "";
          event.configuration ??= "";
          event.itinerary ??= "";
          event.logistics ??= "";
          event.contingency ??= "";
          event.schemaVersion = 6;
        });
      await tx
        .table(TABLES.attendees)
        .toCollection()
        .modify((attendee: Partial<AttendeeRecord>) => {
          attendee.briefingNotes ??= "";
          attendee.schemaVersion = 6;
        });
    },
  },
  {
    // Session 12 (ADR-0011): every draft written before this version was the model's
    // follow-up, so the backfill is `follow-up`; `pre-event` exists only from v7. The
    // event gains its address and coordinates, empty until she enters them. The audit
    // record's model and template become nullable; no existing row changes, because
    // every existing row was generated by a model. No index changes.
    version: 7,
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
      [TABLES.images]: "id, ownerId",
      [TABLES.contacts]: "id, eventId, updatedAt",
    },
    upgrade: async (tx) => {
      await tx
        .table(TABLES.drafts)
        .toCollection()
        .modify((draft: Partial<DraftRecord>) => {
          draft.kind ??= "follow-up";
          draft.schemaVersion = 7;
        });
      await tx
        .table(TABLES.events)
        .toCollection()
        .modify((event: Partial<EventRecord>) => {
          event.address ??= "";
          event.coordinates ??= "";
          event.schemaVersion = 7;
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
