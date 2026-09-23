/**
 * Retention: the clock, the due point, the notice window, and the sweep. ADR-0013.
 *
 * Every case states the moment it means rather than arranging for one: `retentionFor`
 * takes `now` as a parameter for exactly that reason. The numbers are read from the
 * constants, never repeated, so a change to a period moves the tests with it instead of
 * leaving them asserting a number the code no longer uses.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createAttendee,
  createDraftWithAudit,
  createEvent,
  createNote,
  deletionDueAt,
  getDraft,
  listAttendees,
  listAuditRecords,
  listEvents,
  listNotes,
  NOTICE_DAYS_BEFORE_DELETION,
  NOTICE_FROM_DAY,
  noticeFromAt,
  RETENTION_DAYS,
  retentionClockAt,
  retentionFor,
  sweepExpiredEvents,
  type EventRecord,
  updateEventTimes,
} from "@/lib/db";
import { setDatabase } from "@/lib/db/database";

import { FakeDatabase } from "./support/fake-database";

const DAY = 24 * 60 * 60 * 1000;

/** An event record shaped for the pure functions; only the three timestamps matter. */
function eventAt(times: Partial<EventRecord>): EventRecord {
  return {
    id: "e1",
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 9,
    name: "Halewood mobile unit",
    siteLabel: "",
    startsAt: null,
    endsAt: null,
    status: "closed",
    objectives: "",
    configuration: "",
    itinerary: "",
    logistics: "",
    contingency: "",
    address: "",
    coordinates: "",
    forwardableEnabled: false,
    ...times,
  };
}

describe("the periods are build-time constants, and the rule reads them", () => {
  it("keeps content for 14 days and gives notice for the last 7", () => {
    // The only two literals in this file, and they are the decision itself: everything
    // below reads them rather than repeating what they happen to be today.
    expect(RETENTION_DAYS).toBe(14);
    expect(NOTICE_DAYS_BEFORE_DELETION).toBe(7);
  });

  it("derives the notice day rather than repeating it", () => {
    // Written as the gap, so changing the retention period moves the notice with it
    // instead of putting it after the deletion. It survived exactly that on 2026-09-23,
    // when the period went from thirty days to fourteen and this line did not move.
    expect(NOTICE_FROM_DAY).toBe(RETENTION_DAYS - NOTICE_DAYS_BEFORE_DELETION);
    expect(NOTICE_FROM_DAY).toBeGreaterThan(0);
    expect(NOTICE_FROM_DAY).toBeLessThan(RETENTION_DAYS);
  });

  it("computes every date from the constants, not from literals", () => {
    const event = eventAt({ endsAt: 1_000_000 });
    expect(deletionDueAt(event)).toBe(1_000_000 + RETENTION_DAYS * DAY);
    expect(noticeFromAt(event)).toBe(
      deletionDueAt(event) - NOTICE_DAYS_BEFORE_DELETION * DAY,
    );
  });
});

describe("the clock, in the order the decision sets", () => {
  it("keys on endsAt when it is set", () => {
    const event = eventAt({ endsAt: 500, startsAt: 200, updatedAt: 100 });
    expect(retentionClockAt(event)).toBe(500);
  });

  it("falls back to startsAt when endsAt is null", () => {
    const event = eventAt({ endsAt: null, startsAt: 200, updatedAt: 100 });
    expect(retentionClockAt(event)).toBe(200);
  });

  it("falls back to updatedAt when both are null", () => {
    const event = eventAt({ endsAt: null, startsAt: null, updatedAt: 100 });
    expect(retentionClockAt(event)).toBe(100);
  });

  it("treats a zero timestamp as a time, not as absent", () => {
    // `?? `, not `||`: an event ending at the epoch is not an event with no end.
    const event = eventAt({ endsAt: 0, startsAt: 999, updatedAt: 888 });
    expect(retentionClockAt(event)).toBe(0);
  });
});

describe("the due point", () => {
  const ended = 1_000_000_000_000;
  const event = eventAt({ endsAt: ended });

  it("is due at the retention period from endsAt, and after", () => {
    expect(retentionFor(event, ended + RETENTION_DAYS * DAY).state).toBe("due");
    expect(retentionFor(event, ended + (RETENTION_DAYS + 1) * DAY).state).toBe("due");
  });

  it("is not due the day before", () => {
    expect(retentionFor(event, ended + (RETENTION_DAYS - 1) * DAY).state).not.toBe("due");
  });

  it("is due on the fallback clocks too", () => {
    const byStart = eventAt({ endsAt: null, startsAt: ended });
    const byUpdate = eventAt({ endsAt: null, startsAt: null, updatedAt: ended });
    expect(retentionFor(byStart, ended + RETENTION_DAYS * DAY).state).toBe("due");
    expect(retentionFor(byUpdate, ended + RETENTION_DAYS * DAY).state).toBe("due");
  });
});

describe("the notice window", () => {
  const ended = 1_000_000_000_000;
  const event = eventAt({ endsAt: ended });

  it("shows the notice from the notice day, with the whole window remaining", () => {
    const opening = retentionFor(event, ended + NOTICE_FROM_DAY * DAY);
    expect(opening.state).toBe("notice");
    expect(opening.daysRemaining).toBe(NOTICE_DAYS_BEFORE_DELETION);
  });

  it("does not show it the day before", () => {
    expect(retentionFor(event, ended + (NOTICE_FROM_DAY - 1) * DAY).state).toBe("active");
  });

  it("states the date the content will be deleted", () => {
    const { dueAt } = retentionFor(event, ended + (NOTICE_FROM_DAY + 1) * DAY);
    expect(dueAt).toBe(ended + RETENTION_DAYS * DAY);
    expect(new Date(dueAt).getTime() - new Date(ended).getTime()).toBe(
      RETENTION_DAYS * DAY,
    );
  });

  it("stops being a notice once it is due", () => {
    expect(retentionFor(event, ended + RETENTION_DAYS * DAY).state).toBe("due");
  });
});

describe("the sweep", () => {
  beforeEach(() => {
    setDatabase(new FakeDatabase().asDatabase());
  });

  afterEach(() => {
    setDatabase(null);
  });

  it("deletes an event's content past due, and the audit records survive", async () => {
    const now = Date.now();
    const event = await createEvent({ name: "Carrowmore mobile unit" });
    const attendee = await createAttendee({
      eventId: event.id,
      displayName: "Dr. Okonjo-Baptiste",
    });
    await createNote({ eventId: event.id, attendeeId: attendee.id, body: "A note." });
    const { draft, audit } = await createDraftWithAudit({
      eventId: event.id,
      attendeeId: attendee.id,
      kind: "follow-up",
      body: "Dear Dr. Okonjo-Baptiste,",
      blocked: null,
      flagsFired: [],
      model: "claude-opus-5",
      promptTemplateVersion: "1.2.0",
      guardrailRulesetVersion: "1.4.0",
      inputHash: "a".repeat(64),
      outputHash: "b".repeat(64),
      passagesUsed: [],
      libraryVersion: null,
    });

    const deleted = await sweepExpiredEvents(now + (RETENTION_DAYS + 1) * DAY);

    expect(deleted).toEqual([event.id]);
    expect(await listEvents()).toEqual([]);
    expect(await listAttendees(event.id)).toEqual([]);
    expect(await listNotes(event.id)).toEqual([]);
    expect(await getDraft(draft.id)).toBeUndefined();

    // ADR-0008: the record outlives the event it points at, orphaned on purpose.
    const records = await listAuditRecords();
    expect(records).toHaveLength(1);
    expect(records[0]!.id).toBe(audit.id);
    expect(records[0]!.eventId).toBe(event.id);
  });

  it("leaves an event that is not yet due, including one inside the notice window", async () => {
    const now = Date.now();
    const event = await createEvent({ name: "Northgate demonstration day" });
    await createNote({ eventId: event.id, attendeeId: null, body: "Still current." });

    expect(await sweepExpiredEvents(now + (RETENTION_DAYS - 1) * DAY)).toEqual([]);
    expect(await listEvents()).toHaveLength(1);
    expect(await listNotes(event.id)).toHaveLength(1);
    expect(
      retentionFor((await listEvents())[0]!, now + NOTICE_FROM_DAY * DAY).state,
    ).toBe("notice");
  });

  it("deletes every event past due, not only the first", async () => {
    const now = Date.now();
    await createEvent({ name: "One" });
    await createEvent({ name: "Two" });
    const deleted = await sweepExpiredEvents(now + (RETENTION_DAYS + 1) * DAY);
    expect(deleted).toHaveLength(2);
    expect(await listEvents()).toEqual([]);
  });

  it("keys the sweep on endsAt when the event has one", async () => {
    const now = Date.now();
    const event = await createEvent({ name: "Ends later" });
    // `updatedAt` is now, but the event ends well in the future.
    await updateEventTimes(event.id, {
      startsAt: now + 60 * DAY,
      endsAt: now + 61 * DAY,
    });
    // Past due on the `updatedAt` fallback, nowhere near it on `endsAt`. If the sweep
    // read the wrong clock this is the moment it would delete a future event.
    expect(await sweepExpiredEvents(now + (RETENTION_DAYS + 1) * DAY)).toEqual([]);
    expect(await listEvents()).toHaveLength(1);
  });
});
