/**
 * Migration v6, run against the fake database: an event written before the briefing
 * gains five empty dossier fields, an attendee gains empty briefing notes, and both keep
 * everything else. No row is created in the two new tables.
 */

import type { Transaction } from "dexie";
import { describe, expect, it } from "vitest";

import { MIGRATIONS, type AttendeeRecord, type EventRecord } from "@/lib/db";

import { FakeDatabase } from "./support/fake-database";

type V5Event = Omit<
  EventRecord,
  | "objectives"
  | "configuration"
  | "itinerary"
  | "logistics"
  | "contingency"
  | "address"
  | "coordinates"
>;
type V5Attendee = Omit<AttendeeRecord, "briefingNotes">;

const event: V5Event = {
  id: "event-1",
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 5,
  name: "Northgate demonstration day",
  siteLabel: "Bay 3",
  startsAt: null,
  status: "active",
};

const attendee: V5Attendee = {
  id: "att-1",
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 4,
  eventId: "event-1",
  displayName: "Dr. Peter Vance",
  kind: "hcp",
  role: "Consultant",
  specialty: "Urology",
  institution: "Northgate",
  source: "captured",
};

describe("migration v6", () => {
  it("backfills empty dossier fields and briefing notes, and creates nothing", async () => {
    const migration = MIGRATIONS.find((m) => m.version === 6);
    expect(migration?.upgrade).toBeDefined();
    expect(migration?.stores.images).toBe("id, ownerId");
    expect(migration?.stores.contacts).toBe("id, eventId, updatedAt");
    const db = new FakeDatabase();
    await db.events.put(event);
    await db.attendees.put(attendee);
    await migration!.upgrade!(db as unknown as Transaction);

    const upgradedEvent = db.events.rows.get("event-1") as unknown as EventRecord;
    expect(upgradedEvent.objectives).toBe("");
    expect(upgradedEvent.configuration).toBe("");
    expect(upgradedEvent.itinerary).toBe("");
    expect(upgradedEvent.logistics).toBe("");
    expect(upgradedEvent.contingency).toBe("");
    expect(upgradedEvent.siteLabel).toBe("Bay 3");
    expect(upgradedEvent.schemaVersion).toBe(6);

    const upgradedAttendee = db.attendees.rows.get("att-1") as unknown as AttendeeRecord;
    expect(upgradedAttendee.briefingNotes).toBe("");
    expect(upgradedAttendee.kind).toBe("hcp");
    expect(upgradedAttendee.schemaVersion).toBe(6);

    expect(db.images.rows.size).toBe(0);
    expect(db.contacts.rows.size).toBe(0);
  });
});
