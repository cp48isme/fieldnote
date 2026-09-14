/**
 * Migration v4, run against the fake database: the `kind` backfill is the old heuristic,
 * so nothing already stored changes class. A v3 attendee with a specialty becomes `hcp`;
 * one without becomes `staff`; one that somehow already has a kind keeps it.
 *
 * Session 8's PR claimed a migration test it did not have. This is the shape one takes
 * here: the registered migration's own `upgrade` function, over rows written at the
 * previous version, through the fake's `table().toCollection().modify()` seam.
 */

import type { Transaction } from "dexie";
import { describe, expect, it } from "vitest";

import { MIGRATIONS, TABLES, type AttendeeRecord } from "@/lib/db";

import { FakeDatabase } from "./support/fake-database";

type V3Attendee = Omit<AttendeeRecord, "kind">;

function v3(id: string, specialty: string): V3Attendee {
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 3,
    eventId: "event-1",
    displayName: id,
    role: "",
    specialty,
    institution: "",
    source: "captured",
  };
}

describe("migration v4", () => {
  it("backfills kind from the old specialty heuristic and stamps the version", async () => {
    const migration = MIGRATIONS.find((m) => m.version === 4);
    expect(migration?.upgrade).toBeDefined();

    const db = new FakeDatabase();
    await db.attendees.put(v3("with-specialty", "Colorectal"));
    await db.attendees.put(v3("without-specialty", ""));
    await db.attendees.put(v3("whitespace-specialty", "   "));
    await db.attendees.put({
      ...v3("already-kinded", "Colorectal"),
      kind: "staff",
    } as V3Attendee);

    // The fake's `table()` seam is the part of Dexie's Transaction the upgrade uses.
    await migration!.upgrade!(db as unknown as Transaction);

    const rows = new Map(
      [...db.attendees.rows.values()].map((row) => [
        row.id,
        row as unknown as AttendeeRecord,
      ]),
    );
    expect(rows.get("with-specialty")!.kind).toBe("hcp");
    expect(rows.get("without-specialty")!.kind).toBe("staff");
    expect(rows.get("whitespace-specialty")!.kind).toBe("staff");
    expect(rows.get("already-kinded")!.kind).toBe("staff");
    for (const row of rows.values()) expect(row.schemaVersion).toBe(4);
    expect(TABLES.attendees).toBe("attendees");
  });
});
