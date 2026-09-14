/**
 * What this device holds about one person: their record, and their notes and drafts
 * across every event, in the order they happened.
 *
 * An attendee record belongs to one event, so "the same person at two events" is two
 * records. They are joined here by canonical name — `canonicalNameOf`, titles stripped,
 * case-insensitive — which is the join the pseudonymizer itself uses to recognise a
 * rostered person, and no looser: a one-letter slip is a different person here, as it is
 * there, and the view says the join is by name so a reader knows what it is looking at.
 *
 * Nothing here fetches. Plan §2 names this profile as the second most serious issue in
 * the project — personal data about physicians, assembled without their knowledge — and
 * this module assembles it only from what the representative herself typed, dictated, or
 * imported on this device. The view says so on its first line.
 */

import {
  getEvent,
  listAllAttendees,
  listDraftsForAttendee,
  listNotesForAttendee,
  type AttendeeRecord,
  type DraftRecord,
  type EventRecord,
  type Id,
  type NoteRecord,
} from "@/lib/db";
import { canonicalNameOf } from "@/lib/privacy/pseudonymize";

export interface HistoryEvent {
  event: EventRecord | null;
  /** The record for this person at that event. */
  attendee: AttendeeRecord;
  notes: NoteRecord[];
  drafts: DraftRecord[];
}

export interface AttendeeHistory {
  /** The record the view was opened on. */
  attendee: AttendeeRecord;
  /** This person's records across events, oldest event first, the opened one included. */
  events: HistoryEvent[];
  /** How the records were joined, for the view to state. */
  joinedBy: "name";
}

const fold = (displayName: string) => canonicalNameOf(displayName).toLowerCase();

export async function loadHistory(attendee: AttendeeRecord): Promise<AttendeeHistory> {
  const key = fold(attendee.displayName);
  const records = (await listAllAttendees()).filter(
    (candidate) =>
      candidate.id === attendee.id ||
      (key.length > 0 && fold(candidate.displayName) === key),
  );

  const events = await Promise.all(
    records.map(async (record) => ({
      event: (await getEvent(record.eventId)) ?? null,
      attendee: record,
      notes: await listNotesForAttendee(record.id),
      drafts: await listDraftsForAttendee(record.id),
    })),
  );
  events.sort(
    (a, b) =>
      (a.event?.startsAt ?? a.attendee.createdAt) -
      (b.event?.startsAt ?? b.attendee.createdAt),
  );

  return { attendee, events, joinedBy: "name" };
}

export type { Id };
