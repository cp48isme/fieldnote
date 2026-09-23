/**
 * Retention: when an event's content is deleted, and when she is told it will be.
 *
 * ADR-0013, and the owner's decision of 2026-09-17 in `fieldnote-iox`'s notes. The
 * decision, in full, because a rule scattered across a component is a rule nobody can
 * check: an event's content is deleted 14 days after the event ends; from day 7 the app
 * says so and gives the date; she can still delete anything at any time; audit records
 * are never pruned; and the periods are build-time constants rather than a setting.
 *
 * NOTHING IS STORED, AND THAT IS THE DECISION (ADR-0013). Every date here is computed
 * from fields the event already has, so the schema stays at v9 with no migration. Two
 * things that costs, both accepted rather than overlooked: there is no dismissed-at, so
 * the notice shows on every load through the whole window — right for a notice, wrong for
 * a prompt, and this is a notice; and after a deletion nothing distinguishes retention's
 * work from her own, because the event is gone either way and its audit records are
 * orphaned either way (ADR-0008).
 *
 * THE SWEEP RUNS ON LOAD, NOT ON A TIMER. An installed web app is not running when it is
 * closed, so a `setInterval` would only delete while she happened to be looking at the
 * screen — a rule that holds when observed is not a rule. Running it on load means the
 * deletion happens the next time the app opens after the due date, which is the earliest
 * moment the application exists to do it.
 */

import { deleteEvent, listEvents } from "./repository";
import type { EventRecord, Id } from "./schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How long an event's content is kept after the event ends. A build-time constant: the
 * private fork may carry a different number to match an employer's schedule, and no
 * screen offers it as a setting.
 */
export const RETENTION_DAYS = 14;

/**
 * How long before deletion the notice appears. The decision says "from day 7", which is
 * this subtracted from `RETENTION_DAYS`; it is written as the gap rather than as a day
 * number so that changing the retention period moves the notice with it instead of
 * silently putting it after the deletion. It kept its shape when the period went from
 * thirty days to fourteen on 2026-09-23, which is what writing it as a gap was for.
 */
export const NOTICE_DAYS_BEFORE_DELETION = 7;

/**
 * The day the notice starts, derived rather than repeated. At the current periods it
 * equals `NOTICE_DAYS_BEFORE_DELETION`, because fourteen days with seven days of notice
 * puts the notice at the halfway point. That is arithmetic at these two values and not a
 * relationship between them, so nothing here or in the tests leans on it.
 */
export const NOTICE_FROM_DAY = RETENTION_DAYS - NOTICE_DAYS_BEFORE_DELETION;

/**
 * The instant the clock starts, in the order the decision sets: when the event ended, or
 * failing that when it started, or failing that when its record was last written.
 *
 * One function, used by every date below and by every test, so the rule and what checks
 * it cannot disagree. `updatedAt` is never null, so this always returns a number.
 */
export function retentionClockAt(event: EventRecord): number {
  return event.endsAt ?? event.startsAt ?? event.updatedAt;
}

/** When this event's content is deleted. */
export function deletionDueAt(event: EventRecord): number {
  return retentionClockAt(event) + RETENTION_DAYS * MS_PER_DAY;
}

/** When the notice starts appearing: `NOTICE_DAYS_BEFORE_DELETION` before that. */
export function noticeFromAt(event: EventRecord): number {
  return deletionDueAt(event) - NOTICE_DAYS_BEFORE_DELETION * MS_PER_DAY;
}

export type RetentionState = "active" | "notice" | "due";

export interface Retention {
  state: RetentionState;
  /** When the content is deleted, as epoch milliseconds. */
  dueAt: number;
  /** Whole days from `now` to `dueAt`, rounded up; negative once past due. */
  daysRemaining: number;
}

/**
 * Where this event stands. `due` means the next load deletes it; `notice` means the
 * screen says so and gives the date; `active` means neither.
 *
 * `now` is a parameter rather than a clock read, so a test states the moment it means
 * instead of arranging for one.
 */
export function retentionFor(event: EventRecord, now: number): Retention {
  const dueAt = deletionDueAt(event);
  const state: RetentionState =
    now >= dueAt ? "due" : now >= noticeFromAt(event) ? "notice" : "active";
  return {
    state,
    dueAt,
    daysRemaining: Math.ceil((dueAt - now) / MS_PER_DAY),
  };
}

/** The date the notice states, in the device's own locale and time zone. */
export function formatDeletionDate(dueAt: number): string {
  return new Date(dueAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Deletes the content of every event past due, and returns what it deleted.
 *
 * Reuses `deleteEvent`, so the cascade is the one cascade and retention cannot drift
 * from a hand delete: attendees, notes, drafts, contacts, and images go; audit records
 * stay, by ADR-0008, orphaned with an `eventId` that resolves to nothing.
 *
 * A failure on one event does not stop the others. The alternative — one throw abandoning
 * the sweep — means a single bad record keeps every other event past its retention date,
 * which is the failure that matters here. Each is its own transaction already.
 */
export async function sweepExpiredEvents(now: number): Promise<Id[]> {
  const deleted: Id[] = [];
  for (const event of await listEvents()) {
    if (retentionFor(event, now).state !== "due") continue;
    try {
      await deleteEvent(event.id);
      deleted.push(event.id);
    } catch (cause) {
      // Nothing to report to: no error service (CLAUDE.md), and she cannot act on this
      // mid-event. The event stays and the next load tries again.
      console.warn("Retention could not delete an event; it stays for now.", cause);
    }
  }
  return deleted;
}
