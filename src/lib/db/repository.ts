/**
 * The data-access layer. The only route to persistence.
 *
 * No module outside `src/lib/db/` imports Dexie; everything goes through here. Per
 * ADR-0004 that is the single rule the encryption work depends on, and it is enforced
 * by `tests/unit/db-boundary.test.ts` rather than by discipline.
 *
 * Two schema decisions were made here rather than read from the plan. The first is
 * recorded in the session 2 report; the second is ADR-0008.
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
 *    assessment should address rather than discover. ADR-0008 is the record, and it
 *    states what a record must therefore carry.
 */

import { editDistance } from "@/lib/review/edit-distance";

import { encryptRecord, decryptAll, decryptRecord } from "./cipher";
import { getDatabase } from "./database";
import { assertTransition, canEdit } from "./draft-state";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_AUTOSAVE_DEBOUNCE_MS,
  TABLES,
  type AttendeeRecord,
  type AuditRecordRecord,
  type DraftBlockReason,
  type DraftRecord,
  type EventRecord,
  type Id,
  type NoteRecord,
  type NoteSource,
  type SessionMarkerRecord,
  type SettingsRecord,
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

// --- Drafts and audit records ----------------------------------------------
//
// A draft never exists without its audit record. There is one write path for a new
// draft, `createDraftWithAudit`, and it writes both rows in one transaction; there is no
// `createDraft`. That is the shape CLAUDE.md's no-silent-generations agreement requires,
// and `tests/unit/repository-drafts.test.ts` demonstrates it by making the audit write
// fail and finding no draft afterwards.
//
// The two review-gate transitions each go through `assertTransition` against the table
// in `draft-state.ts`, and each fills audit fields that are null until then. Nothing
// else writes `state`. Audit records are never deleted here or anywhere — see
// `deleteEvent` above and ADR-0008.

export interface NewDraftInput {
  eventId: Id;
  attendeeId: Id | null;
  /** Rehydrated, guarded text. Empty when blocked. */
  body: string;
  blocked: DraftBlockReason | null;
  flagsFired: string[];
  model: string;
  promptTemplateVersion: string;
  guardrailRulesetVersion: string;
  inputHash: string | null;
  outputHash: string | null;
}

export interface DraftWithAudit {
  draft: DraftRecord;
  audit: AuditRecordRecord;
}

export async function createDraftWithAudit(
  input: NewDraftInput,
): Promise<DraftWithAudit> {
  if (input.blocked !== null && input.body.length > 0) {
    // The pipeline never produces this; stated so the invariant is visible here too.
    throw new Error("A blocked draft has no body.");
  }
  const draft: DraftRecord = stamp({
    eventId: input.eventId,
    attendeeId: input.attendeeId,
    body: input.body,
    generatedBody: input.body,
    state: input.blocked === null ? ("generated" as const) : ("blocked" as const),
    blocked: input.blocked,
    flagsFired: [...input.flagsFired],
    promptTemplateVersion: input.promptTemplateVersion,
    guardrailRulesetVersion: input.guardrailRulesetVersion,
  });
  const audit: AuditRecordRecord = stamp({
    draftId: draft.id,
    eventId: input.eventId,
    model: input.model,
    promptTemplateVersion: input.promptTemplateVersion,
    guardrailRulesetVersion: input.guardrailRulesetVersion,
    inputHash: input.inputHash,
    outputHash: input.outputHash,
    flagsFired: [...input.flagsFired],
    blocked: input.blocked,
    reviewedAt: null,
    exportedAt: null,
    humanEdited: null,
    editDistance: null,
  });

  const db = getDatabase();
  await db.transaction("rw", db.drafts, db.auditRecords, async () => {
    // Audit first. If the draft write is what fails, the transaction rolls both back;
    // if the audit write fails, no draft was ever attempted. Either way the invariant
    // holds without depending on the order — the order is for the reader.
    await db.auditRecords.put(encryptRecord(TABLES.auditRecords, audit));
    await db.drafts.put(encryptRecord(TABLES.drafts, draft));
  });
  return { draft, audit };
}

export async function getDraft(id: Id): Promise<DraftRecord | undefined> {
  const row = await getDatabase().drafts.get(id);
  return row ? decryptRecord(TABLES.drafts, row) : undefined;
}

/** Newest first: the review question is "what did I just generate". */
export async function listDrafts(eventId: Id): Promise<DraftRecord[]> {
  const rows = await getDatabase().drafts.where("eventId").equals(eventId).toArray();
  return decryptAll(TABLES.drafts, rows).sort((a, b) => b.createdAt - a.createdAt);
}

async function requireDraft(id: Id): Promise<DraftRecord> {
  const draft = await getDraft(id);
  if (!draft) throw new Error(`Draft ${id} not found`);
  return draft;
}

async function requireAuditFor(draftId: Id): Promise<AuditRecordRecord> {
  const audit = await getAuditRecordForDraft(draftId);
  // A draft with no record is the invariant this layer exists to hold. Loud, not tolerated.
  if (!audit) throw new Error(`Draft ${draftId} has no audit record`);
  return audit;
}

/**
 * The representative's edits, while export is still ahead. Refused once exported — the
 * body is then the record of what was sent — and refused for a blocked draft, which has
 * no body to edit. `generatedBody` is never touched.
 */
export async function saveDraftBody(id: Id, body: string): Promise<DraftRecord> {
  const existing = await requireDraft(id);
  if (!canEdit(existing.state)) {
    throw new Error(`A draft in state "${existing.state}" cannot be edited`);
  }
  const updated: DraftRecord = { ...existing, body, updatedAt: now() };
  await getDatabase().drafts.put(encryptRecord(TABLES.drafts, updated));
  return updated;
}

/**
 * `generated` → `reviewed`: a human opened the draft. The act is opening it in the review
 * surface — not a list row rendering, which is why the surface calls this from the
 * detail view and nowhere else. Stamps `reviewedAt` on the audit record, once.
 */
export async function markReviewed(id: Id): Promise<DraftWithAudit> {
  const db = getDatabase();
  return db.transaction("rw", db.drafts, db.auditRecords, async () => {
    const existing = await requireDraft(id);
    assertTransition(existing.state, "reviewed");
    const audit = await requireAuditFor(id);
    const timestamp = now();
    const draft: DraftRecord = { ...existing, state: "reviewed", updatedAt: timestamp };
    const stamped: AuditRecordRecord = {
      ...audit,
      reviewedAt: audit.reviewedAt ?? timestamp,
      updatedAt: timestamp,
    };
    await db.drafts.put(encryptRecord(TABLES.drafts, draft));
    await db.auditRecords.put(encryptRecord(TABLES.auditRecords, stamped));
    return { draft, audit: stamped };
  });
}

/**
 * `reviewed` → `exported`: the text was copied to the mail client. `exportedBody` is what
 * was copied; it becomes the draft's body and the edit distance is measured from
 * `generatedBody` to it. The audit record's export fields are written here and only
 * here, and refused if already written — the state check makes that unreachable, and the
 * second check is there so the record's immutability does not rest on one line.
 */
export async function exportDraft(id: Id, exportedBody: string): Promise<DraftWithAudit> {
  const db = getDatabase();
  return db.transaction("rw", db.drafts, db.auditRecords, async () => {
    const existing = await requireDraft(id);
    assertTransition(existing.state, "exported");
    const audit = await requireAuditFor(id);
    if (audit.exportedAt !== null) {
      throw new Error(`Audit record for draft ${id} already carries an export`);
    }
    const timestamp = now();
    const distance = editDistance(existing.generatedBody, exportedBody);
    const draft: DraftRecord = {
      ...existing,
      body: exportedBody,
      state: "exported",
      updatedAt: timestamp,
    };
    const stamped: AuditRecordRecord = {
      ...audit,
      exportedAt: timestamp,
      humanEdited: distance > 0,
      editDistance: distance,
      updatedAt: timestamp,
    };
    await db.drafts.put(encryptRecord(TABLES.drafts, draft));
    await db.auditRecords.put(encryptRecord(TABLES.auditRecords, stamped));
    return { draft, audit: stamped };
  });
}

export async function getAuditRecordForDraft(
  draftId: Id,
): Promise<AuditRecordRecord | undefined> {
  const rows = await getDatabase()
    .auditRecords.where("draftId")
    .equals(draftId)
    .toArray();
  const [row] = decryptAll(TABLES.auditRecords, rows);
  return row;
}

/**
 * Every audit record on the device, oldest first, including those whose event has been
 * deleted (ADR-0008). The CSV export reads this; nothing filters it.
 */
export async function listAuditRecords(): Promise<AuditRecordRecord[]> {
  const rows = await getDatabase().auditRecords.orderBy("createdAt").toArray();
  return decryptAll(TABLES.auditRecords, rows);
}

// --- Settings --------------------------------------------------------------

/**
 * Settings is a singleton row under a fixed key.
 *
 * A generated id would mean every read had to find "the row", which is a query with no
 * answer when there are two. A constant makes the singleton a fact rather than a
 * convention. It is a stable identifier, not a magic value: nothing else may use it.
 */
const SETTINGS_ID: Id = "settings";

async function readSettings(): Promise<SettingsRecord | undefined> {
  const row = await getDatabase().settings.get(SETTINGS_ID);
  return row ? decryptRecord(TABLES.settings, row) : undefined;
}

/**
 * Which event capture is currently on.
 *
 * Persisted rather than inferred, because inferring it as "the most recent event" silently
 * discards the user's choice on every reload — switch to last week's event, reload, and you
 * are back on this week's, writing into the wrong one.
 */
export async function getActiveEventId(): Promise<Id | null> {
  return (await readSettings())?.activeEventId ?? null;
}

export async function setActiveEventId(eventId: Id | null): Promise<void> {
  const existing = await readSettings();
  const timestamp = now();
  const record: SettingsRecord = existing
    ? { ...existing, activeEventId: eventId, updatedAt: timestamp }
    : {
        id: SETTINGS_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        activeEventId: eventId,
        autosaveDebounceMs: DEFAULT_AUTOSAVE_DEBOUNCE_MS,
      };
  await getDatabase().settings.put(encryptRecord(TABLES.settings, record));
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
