/** Migration v8, run against the fake database: an event gains a null end time and keeps its start. */

import type { Transaction } from "dexie";
import { describe, expect, it } from "vitest";

import { MIGRATIONS, type EventRecord } from "@/lib/db";

import { FakeDatabase } from "./support/fake-database";

type V7Event = Omit<EventRecord, "endsAt">;

const event: V7Event = {
  id: "event-1",
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 7,
  name: "Northgate demonstration day",
  siteLabel: "",
  startsAt: 1_000,
  status: "active",
  objectives: "",
  configuration: "",
  itinerary: "",
  logistics: "",
  contingency: "",
  address: "",
  coordinates: "",
};

describe("migration v8", () => {
  it("backfills a null end time", async () => {
    const migration = MIGRATIONS.find((m) => m.version === 8);
    expect(migration?.upgrade).toBeDefined();
    const db = new FakeDatabase();
    await db.events.put(event);
    await migration!.upgrade!(db as unknown as Transaction);
    const upgraded = db.events.rows.get("event-1") as unknown as EventRecord;
    expect(upgraded.endsAt).toBeNull();
    expect(upgraded.startsAt).toBe(1_000);
    expect(upgraded.schemaVersion).toBe(8);
  });
});
