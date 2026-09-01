/**
 * The data-access layer. The only route to persistence.
 *
 * No module outside `src/lib/db/` imports Dexie; everything goes through here. Per
 * ADR-0004 that is the single rule the encryption work depends on, and it is enforced
 * by `tests/unit/db-boundary.test.ts` rather than by discipline.
 *
 * Two schema decisions were made here rather than read from the plan. Both are recorded
 * in the session report and may deserve an ADR.
 *
 * 1. `Note.attendeeId` is nullable.
 *
 *    In the field, a note is often captured before the person is identified — someone
 *    asks a question in passing and the name arrives later, or never. The alternatives
 *    were a placeholder "unknown attendee" row per event, or requiring identification
 *    before capture. Requiring it is wrong: it puts a form between the representative
 *    and the thing they are trying to write down in twenty seconds, which is the
 *    failure this project exists to fix. A placeholder row is worse than null, because
 *    it looks like a person, would appear in attendee lists and counts, and would need
 *    special-casing at every read anyway. Null says exactly what is true — this note is
 *    not yet attributed — and attribution becomes an ordinary update later.
 *
 * 2. Deleting an event cascades to attendees, notes, and drafts — but NOT to audit
 *    records.
 *
 *    Attendees, notes, and drafts are meaningless without their event, so they go.
 *    Audit records are deliberately kept. Plan §4.4 calls them immutable, and if
 *    deleting an event erased them, then deleting an event would erase the evidence
 *    that generation ever happened — which turns a cleanup action into a way to destroy
 *    the audit trail. An audit log that a user can silently truncate is not an audit
 *    log. They are therefore orphaned by design: `AuditRecord.eventId` may point at an
 *    event that no longer exists, and any reader must tolerate that.
 *
 *    This has a retention consequence ADR-0004 gestures at — the local store does not
 *    shrink to nothing when events are deleted — which session 16's data-protection
 *    assessment should address rather than discover.
 */

import { encryptRecord, decryptAll, decryptRecord } from "./cipher";
import { getDatabase } from "./database";
import {
  CURRENT_SCHEMA_VERSION,
  TABLES,
  type AttendeeRecord,
  type DraftRecord,
  type EventRecord,
  type Id,
  type NoteRecord,
  type NoteSource,
  type SessionMarkerRecord,
} from "./schema";

function newId(): Id {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

/** Stamps the fields plan §5 requires on every record. */
function stamp<T extends object>(
  fields: T,
): T & {
  id: Id;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
} {
  const timestamp = now();
  return {
    ...fields,
    id: newId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

// --- Events ----------------------------------------------------------------

export interface NewEventInput {
  name: string;
  siteLabel?: string;
  startsAt?: number | null;
}

export async function createEvent(input: NewEventInput): Promise<EventRecord> {
  const record: EventRecord = stamp({
    name: input.name,
    siteLabel: input.siteLabel ?? "",
    startsAt: input.startsAt ?? null,
    status: "active" as const,
  });
  await getDatabase().events.put(encryptRecord(TABLES.events, record));
  return record;
}

export async function getEvent(id: Id): Promise<EventRecord | undefined> {
  const row = await getDatabase().events.get(id);
  return row ? decryptRecord(TABLES.events, row) : undefined;
}

export async function listEvents(): Promise<EventRecord[]> {
  const rows = await getDatabase().events.orderBy("updatedAt").reverse().toArray();
  return decryptAll(TABLES.events, rows);
}

/**
 * Cascades to attendees, notes, and drafts. Audit records are retained on purpose —
 * see the header of this file.
 */
export async function deleteEvent(id: Id): Promise<void> {
  const db = getDatabase();
  await db.transaction("rw", db.events, db.attendees, db.notes, db.drafts, async () => {
    await db.attendees.where("eventId").equals(id).delete();
    await db.notes.where("eventId").equals(id).delete();
    await db.drafts.where("eventId").equals(id).delete();
    await db.events.delete(id);
  });
}

// --- Attendees -------------------------------------------------------------

export interface NewAttendeeInput {
  eventId: Id;
  displayName: string;
  role?: string;
  specialty?: string;
  institution?: string;
}

export async function createAttendee(input: NewAttendeeInput): Promise<AttendeeRecord> {
  const record: AttendeeRecord = stamp({
    eventId: input.eventId,
    displayName: input.displayName,
    role: input.role ?? "",
    specialty: input.specialty ?? "",
    institution: input.institution ?? "",
  });
  await getDatabase().attendees.put(encryptRecord(TABLES.attendees, record));
  return record;
}

export async function listAttendees(eventId: Id): Promise<AttendeeRecord[]> {
  const rows = await getDatabase().attendees.where("eventId").equals(eventId).toArray();
  return decryptAll(TABLES.attendees, rows);
}

// --- Notes -----------------------------------------------------------------

export interface NewNoteInput {
  eventId: Id;
  /** Omit or pass null when the person is not yet identified. */
  attendeeId?: Id | null;
  body?: string;
  source?: NoteSource;
}

export async function createNote(input: NewNoteInput): Promise<NoteRecord> {
  const record: NoteRecord = stamp({
    eventId: input.eventId,
    attendeeId: input.attendeeId ?? null,
    body: input.body ?? "",
    source: input.source ?? ("typed" as const),
  });
  await getDatabase().notes.put(encryptRecord(TABLES.notes, record));
  return record;
}

export async function getNote(id: Id): Promise<NoteRecord | undefined> {
  const row = await getDatabase().notes.get(id);
  return row ? decryptRecord(TABLES.notes, row) : undefined;
}

export async function listNotes(eventId: Id): Promise<NoteRecord[]> {
  const rows = await getDatabase().notes.where("eventId").equals(eventId).toArray();
  return decryptAll(TABLES.notes, rows).sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Writes note body. This is what debounced autosave calls, so it is deliberately a
 * whole-record put rather than a partial update: a torn write of a partial field is a
 * worse failure than a slightly larger one.
 */
export async function saveNoteBody(id: Id, body: string): Promise<NoteRecord> {
  const db = getDatabase();
  const existing = await db.notes.get(id);
  if (!existing) throw new Error(`Note ${id} not found`);
  const decrypted = decryptRecord(TABLES.notes, existing);
  const updated: NoteRecord = { ...decrypted, body, updatedAt: now() };
  await db.notes.put(encryptRecord(TABLES.notes, updated));
  return updated;
}

/** Attribution after the fact — the ordinary path for a note captured before a name. */
export async function attributeNote(id: Id, attendeeId: Id | null): Promise<NoteRecord> {
  const db = getDatabase();
  const existing = await db.notes.get(id);
  if (!existing) throw new Error(`Note ${id} not found`);
  const decrypted = decryptRecord(TABLES.notes, existing);
  const updated: NoteRecord = { ...decrypted, attendeeId, updatedAt: now() };
  await db.notes.put(encryptRecord(TABLES.notes, updated));
  return updated;
}

// --- Drafts ----------------------------------------------------------------
// Full draft handling lands in sessions 5 and 6 with the generation route and the
// review gate. Reads exist now so nothing outside this layer needs Dexie to look.

export async function listDrafts(eventId: Id): Promise<DraftRecord[]> {
  const rows = await getDatabase().drafts.where("eventId").equals(eventId).toArray();
  return decryptAll(TABLES.drafts, rows);
}

// --- Session markers (crash recovery) --------------------------------------

export async function insertSessionMarker(marker: SessionMarkerRecord): Promise<void> {
  await getDatabase().sessionMarkers.put(encryptRecord(TABLES.sessionMarkers, marker));
}

export async function updateSessionMarker(marker: SessionMarkerRecord): Promise<void> {
  await getDatabase().sessionMarkers.put(encryptRecord(TABLES.sessionMarkers, marker));
}

export async function listOpenSessionMarkers(
  excludeId?: Id,
): Promise<SessionMarkerRecord[]> {
  const rows = await getDatabase().sessionMarkers.toArray();
  return decryptAll(TABLES.sessionMarkers, rows)
    .filter((marker) => marker.endedAt === null && marker.id !== excludeId)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export async function getSessionMarker(id: Id): Promise<SessionMarkerRecord | undefined> {
  const row = await getDatabase().sessionMarkers.get(id);
  return row ? decryptRecord(TABLES.sessionMarkers, row) : undefined;
}

export async function clearSessionMarkers(ids: Id[]): Promise<void> {
  await getDatabase().sessionMarkers.bulkDelete(ids);
}

export function makeSessionMarker(): SessionMarkerRecord {
  const timestamp = now();
  return {
    ...stamp({
      startedAt: timestamp,
      lastSeenAt: timestamp,
      endedAt: null as number | null,
      touchedNoteIds: [] as Id[],
    }),
  };
}
