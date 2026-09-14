/**
 * The roster import's data-layer half, against the fake database: what a confirmed
 * decision does and what it never does.
 *
 *   - `merge` fills empty details and leaves filled ones and the display name alone.
 *   - `new` creates an attendee marked `imported`; the dock's path stays `captured`.
 *   - The import is one transaction: a failure part-way through leaves nothing behind.
 *   - The function decides nothing: it has no matcher. A proposal that was never
 *     confirmed is not a decision and does not reach it — that is the matcher test's
 *     half, in `tests/unit/roster-match.test.ts`.
 *
 * All names are synthetic, per ADR-0001.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyRosterImport, createAttendee, listAttendees } from "@/lib/db";
import { setDatabase } from "@/lib/db/database";

import { FakeDatabase } from "./support/fake-database";

let db: FakeDatabase;
beforeEach(() => {
  db = new FakeDatabase();
  setDatabase(db.asDatabase());
});
afterEach(() => setDatabase(null));

const EVENT = "event-1";
const DETAILS = {
  role: "Consultant",
  specialty: "Colorectal",
  institution: "Northgate Regional",
};

describe("applyRosterImport", () => {
  it("marks the dock's attendees captured and the sheet's imported", async () => {
    const typed = await createAttendee({ eventId: EVENT, displayName: "Dr. Swali" });
    expect(typed.source).toBe("captured");
    const { added } = await applyRosterImport(EVENT, [
      { kind: "new", displayName: "Dr Green", details: DETAILS },
    ]);
    expect(added[0]!.source).toBe("imported");
    expect(added[0]!.role).toBe("Consultant");
    expect(await listAttendees(EVENT)).toHaveLength(2);
  });

  it("fills only empty details on a merge, and never the display name", async () => {
    const typed = await createAttendee({
      eventId: EVENT,
      displayName: "Marisol Vance",
      role: "Theatre coordinator",
    });
    const { updated, added } = await applyRosterImport(EVENT, [
      {
        kind: "merge",
        attendeeId: typed.id,
        details: { role: "Nurse", specialty: "", institution: "Northgate Regional" },
      },
    ]);
    expect(added).toEqual([]);
    expect(updated[0]!.displayName).toBe("Marisol Vance");
    expect(updated[0]!.role).toBe("Theatre coordinator");
    expect(updated[0]!.institution).toBe("Northgate Regional");
    expect(updated[0]!.specialty).toBe("");
    expect(updated[0]!.source).toBe("captured");
  });

  it("applies all of it or none of it", async () => {
    // Counterfactual: put each write outside the transaction and the first row lands.
    const typed = await createAttendee({ eventId: EVENT, displayName: "Dr. Swali" });
    await expect(
      applyRosterImport(EVENT, [
        { kind: "new", displayName: "Dr Green", details: DETAILS },
        { kind: "merge", attendeeId: "no-such-attendee", details: DETAILS },
      ]),
    ).rejects.toThrow(/not found/);
    const after = await listAttendees(EVENT);
    expect(after.map((a) => a.id)).toEqual([typed.id]);
  });

  it("refuses to merge into an attendee from another event", async () => {
    const elsewhere = await createAttendee({
      eventId: "event-2",
      displayName: "Dr. Swali",
    });
    await expect(
      applyRosterImport(EVENT, [
        { kind: "merge", attendeeId: elsewhere.id, details: DETAILS },
      ]),
    ).rejects.toThrow(/another event/);
  });
});
