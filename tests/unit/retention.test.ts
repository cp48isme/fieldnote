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
  it("keeps content for 30 days and gives notice for the last 7", () => {
    expect(RETENTION_DAYS).toBe(30);
    expect(NOTICE_DAYS_BEFORE_DELETION).toBe(7);
  });

  it("derives day 23 rather than repeating it", () => {
    // The decision says "from day 23". Written as the gap, so changing the retention
    // period moves the notice with it instead of putting it after the deletion.
    expect(NOTICE_FROM_DAY).toBe(23);
    expect(NOTICE_FROM_DAY).toBe(RETENTION_DAYS - NOTICE_DAYS_BEFORE_DELETION);
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

  it("is due at 30 days from endsAt", () => {
    expect(retentionFor(event, ended + 30 * DAY).state).toBe("due");
    expect(retentionFor(event, ended + 31 * DAY).state).toBe("due");
  });

  it("is not due at 29 days", () => {
    expect(retentionFor(event, ended + 29 * DAY).state).not.toBe("due");
  });

  it("is due on the fallback clocks too", () => {
    const byStart = eventAt({ endsAt: null, startsAt: ended });
    const byUpdate = eventAt({ endsAt: null, startsAt: null, updatedAt: ended });
    expect(retentionFor(byStart, ended + 30 * DAY).state).toBe("due");
    expect(retentionFor(byUpdate, ended + 30 * DAY).state).toBe("due");
  });
});

describe("the notice window", () => {
  const ended = 1_000_000_000_000;
  const event = eventAt({ endsAt: ended });

  it("shows the notice from day 23", () => {
    const at23 = retentionFor(event, ended + 23 * DAY);
    expect(at23.state).toBe("notice");
    expect(at23.daysRemaining).toBe(7);
  });

  it("does not show it at day 22", () => {
    expect(retentionFor(event, ended + 22 * DAY).state).toBe("active");
  });

  it("states the date the content will be deleted", () => {
    const { dueAt } = retentionFor(event, ended + 24 * DAY);
    expect(dueAt).toBe(ended + RETENTION_DAYS * DAY);
    expect(new Date(dueAt).toISOString()).toBe(new Date(ended + 30 * DAY).toISOString());
  });

  it("stops being a notice once it is due", () => {
    expect(retentionFor(event, ended + 30 * DAY).state).toBe("due");
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

    expect(await sweepExpiredEvents(now + 29 * DAY)).toEqual([]);
    expect(await listEvents()).toHaveLength(1);
    expect(await listNotes(event.id)).toHaveLength(1);
    expect(retentionFor((await listEvents())[0]!, now + 24 * DAY).state).toBe("notice");
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
    // `updatedAt` is now, but the event ends well in the future: not due.
    await updateEventTimes(event.id, {
      startsAt: now + 60 * DAY,
      endsAt: now + 61 * DAY,
    });
    expect(await sweepExpiredEvents(now + 40 * DAY)).toEqual([]);
    expect(await listEvents()).toHaveLength(1);
  });
});
