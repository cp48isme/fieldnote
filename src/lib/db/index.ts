/**
 * Public surface of the data-access layer.
 *
 * Application code imports from `@/lib/db` and nothing deeper. Dexie itself is reachable
 * only through `database.ts` and `migrations.ts`; see `tests/unit/db-boundary.test.ts`,
 * which fails the build if anything outside this directory imports it.
 */

export {
  identityCipher,
  getCipher,
  setCipher,
  resetCipher,
  encryptRecord,
  decryptRecord,
  decryptAll,
  type FieldCipher,
} from "./cipher";

export { isPersistenceAvailable } from "./database";

export { MIGRATIONS, LATEST_MIGRATION_VERSION } from "./migrations";

export {
  CURRENT_SCHEMA_VERSION,
  TABLES,
  POLICIES_BY_TABLE,
  eligibleFields,
  type Id,
  type EncryptionClass,
  type FieldPolicy,
  type FieldPolicies,
  type BaseRecord,
  type EventRecord,
  type EventStatus,
  type AttendeeRecord,
  type NoteRecord,
  type NoteSource,
  type DraftRecord,
  type DraftState,
  type AuditRecordRecord,
  type VoiceProfileRecord,
  type ApprovedContentRecord,
  type SettingsRecord,
  type SessionMarkerRecord,
  type TableName,
} from "./schema";

export {
  createEvent,
  getEvent,
  listEvents,
  deleteEvent,
  createAttendee,
  listAttendees,
  createNote,
  getNote,
  listNotes,
  saveNoteBody,
  attributeNote,
  listDrafts,
  type NewEventInput,
  type NewAttendeeInput,
  type NewNoteInput,
} from "./repository";

export {
  beginSession,
  endSession,
  resumeSession,
  recordTouchedNote,
  acknowledgeRecovery,
  resetSessionState,
  HEARTBEAT_MS,
  type SessionHandle,
  type RecoveredSession,
} from "./recovery";
