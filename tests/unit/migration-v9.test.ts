/** Migration v9, run against the fake database: an event gains the forwardable flag, off. */

import type { Transaction } from "dexie";
import { describe, expect, it } from "vitest";

import { MIGRATIONS, type EventRecord } from "@/lib/db";

import { FakeDatabase } from "./support/fake-database";

type V8Event = Omit<EventRecord, "forwardableEnabled">;

const event: V8Event = {
  id: "event-1",
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 8,
  name: "Northgate demonstration day",
  siteLabel: "",
  startsAt: 1_000,
  endsAt: 2_000,
  status: "active",
  objectives: "",
  configuration: "",
  itinerary: "",
  logistics: "",
  contingency: "",
  address: "",
  coordinates: "",
};

describe("migration v9", () => {
  it("backfills the forwardable flag as off — the feature ships disabled (ADR-0002)", async () => {
    const migration = MIGRATIONS.find((m) => m.version === 9);
    expect(migration?.upgrade).toBeDefined();
    const db = new FakeDatabase();
    await db.events.put(event);
    await migration!.upgrade!(db as unknown as Transaction);
    const upgraded = db.events.rows.get("event-1") as unknown as EventRecord;
    expect(upgraded.forwardableEnabled).toBe(false);
    expect(upgraded.endsAt).toBe(2_000);
    expect(upgraded.schemaVersion).toBe(9);
  });
});
