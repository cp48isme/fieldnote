/**
 * The Dexie instance.
 *
 * This module and `migrations.ts` are the only places Dexie is imported. Everything
 * else — including UI, hooks, and tests — goes through `repository.ts`. That rule is
 * the one ADR-0004 says must hold, because it is what makes session 19's encryption
 * work a hook swap rather than a rewrite. `tests/unit/db-boundary.test.ts` fails the
 * build if another module imports Dexie.
 */

import Dexie, { type Table } from "dexie";

import { MIGRATIONS } from "./migrations";
import type {
  ApprovedContentRecord,
  AttendeeRecord,
  AuditRecordRecord,
  DraftRecord,
  EventRecord,
  NoteRecord,
  SessionMarkerRecord,
  SettingsRecord,
  VoiceProfileRecord,
} from "./schema";

export class FieldnoteDatabase extends Dexie {
  events!: Table<EventRecord, string>;
  attendees!: Table<AttendeeRecord, string>;
  notes!: Table<NoteRecord, string>;
  drafts!: Table<DraftRecord, string>;
  auditRecords!: Table<AuditRecordRecord, string>;
  voiceProfiles!: Table<VoiceProfileRecord, string>;
  approvedContent!: Table<ApprovedContentRecord, string>;
  settings!: Table<SettingsRecord, string>;
  sessionMarkers!: Table<SessionMarkerRecord, string>;

  constructor(name = "fieldnote") {
    super(name);
    // Applied in ascending order. Dexie derives the delta between consecutive versions,
    // so every migration declares the full store set at its version.
    for (const migration of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
      const version = this.version(migration.version).stores(migration.stores);
      if (migration.upgrade) version.upgrade(migration.upgrade);
    }
  }
}

let instance: FieldnoteDatabase | null = null;

/**
 * Lazily constructed so that importing the data layer does not open IndexedDB. Next
 * renders these modules on the server during build, where `indexedDB` does not exist;
 * opening on import would fail the build.
 */
export function getDatabase(): FieldnoteDatabase {
  instance ??= new FieldnoteDatabase();
  return instance;
}

/** Test seam: swap in a uniquely named database so specs do not share state. */
export function setDatabase(db: FieldnoteDatabase | null): void {
  instance = db;
}

export function isPersistenceAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
