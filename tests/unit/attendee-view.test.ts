/**
 * The attendee view's data half, against the fake database: what an edit changes and
 * what it never changes, and how the history is joined across events.
 *
 * All names are synthetic, per ADR-0001.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadHistory } from "@/lib/attendees/history";
import {
  createAttendee,
  createDraftWithAudit,
  createEvent,
  createNote,
  getAttendee,
  updateAttendee,
} from "@/lib/db";
import { setDatabase } from "@/lib/db/database";

import { FakeDatabase } from "./support/fake-database";

let db: FakeDatabase;
beforeEach(() => {
  db = new FakeDatabase();
  setDatabase(db.asDatabase());
});
afterEach(() => setDatabase(null));

describe("updateAttendee", () => {
  it("saves the five fields, trims them, and leaves source and event alone", async () => {
    const event = await createEvent({ name: "Northgate demonstration day" });
    const typed = await createAttendee({ eventId: event.id, displayName: "Vance" });
    expect(typed.kind).toBe("staff");
    const saved = await updateAttendee(typed.id, {
      displayName: "  Dr. Peter Vance ",
      kind: "hcp",
      role: " Consultant",
      specialty: "Upper GI ",
      institution: "Northgate Regional",
    });
    expect(saved).toMatchObject({
      displayName: "Dr. Peter Vance",
      kind: "hcp",
      role: "Consultant",
      specialty: "Upper GI",
      institution: "Northgate Regional",
      source: "captured",
      eventId: event.id,
    });
    expect(await getAttendee(typed.id)).toEqual(saved);
  });

  it("refuses an empty name", async () => {
    const typed = await createAttendee({ eventId: "e", displayName: "Vance" });
    await expect(
      updateAttendee(typed.id, {
        displayName: "   ",
        kind: "staff",
        role: "",
        specialty: "",
        institution: "",
      }),
    ).rejects.toThrow(/needs a name/);
  });

  it("does not touch an existing draft when the name changes", async () => {
    const typed = await createAttendee({ eventId: "e", displayName: "Vance" });
    const { draft } = await createDraftWithAudit({
      eventId: "e",
      attendeeId: typed.id,
      kind: "follow-up",
      body: "Dear Vance,\n\nThank you.",
      blocked: null,
      flagsFired: [],
      model: "claude-opus-5",
      promptTemplateVersion: "1.1.0",
      guardrailRulesetVersion: "1.2.0",
      inputHash: "a".repeat(64),
      outputHash: "b".repeat(64),
      passagesUsed: [],
      libraryVersion: null,
    });
    await updateAttendee(typed.id, {
      displayName: "Dr. Peter Vance",
      kind: "hcp",
      role: "",
      specialty: "",
      institution: "",
    });
    const history = await loadHistory((await getAttendee(typed.id))!);
    expect(history.events[0]!.drafts[0]!.body).toBe(draft.body);
  });
});

describe("loadHistory", () => {
  it("joins this person's records across events by canonical name, oldest event first", async () => {
    const spring = await createEvent({
      name: "Ridgeway spring clinic day",
      startsAt: 1_000,
    });
    const autumn = await createEvent({
      name: "Northgate demonstration day",
      startsAt: 2_000,
    });
    const other = await createEvent({ name: "Halewood mobile unit", startsAt: 3_000 });

    const atSpring = await createAttendee({
      eventId: spring.id,
      displayName: "Dr Vance",
    });
    const atAutumn = await createAttendee({
      eventId: autumn.id,
      displayName: "Dr. Peter Vance",
    });
    const someoneElse = await createAttendee({
      eventId: other.id,
      displayName: "Marisol Vance",
    });
    await createNote({
      eventId: spring.id,
      attendeeId: atSpring.id,
      body: "Keen on a live case.",
    });
    await createNote({
      eventId: autumn.id,
      attendeeId: atAutumn.id,
      body: "Asked about the port.",
    });
    await createNote({
      eventId: other.id,
      attendeeId: someoneElse.id,
      body: "Wants more notice.",
    });

    // "Dr Vance" and "Dr. Peter Vance" are not the same canonical name — vance vs peter
    // vance — so only the exact canonical match joins. That is the stated limit.
    const history = await loadHistory(atAutumn);
    expect(history.joinedBy).toBe("name");
    expect(history.events.map((e) => e.event?.name)).toEqual([
      "Northgate demonstration day",
    ]);

    const same = await createAttendee({ eventId: spring.id, displayName: "Peter Vance" });
    await createNote({ eventId: spring.id, attendeeId: same.id, body: "First visit." });
    const joined = await loadHistory(atAutumn);
    expect(joined.events.map((e) => e.event?.name)).toEqual([
      "Ridgeway spring clinic day",
      "Northgate demonstration day",
    ]);
    expect(joined.events[0]!.notes.map((n) => n.body)).toEqual(["First visit."]);
    expect(joined.events[0]!.attendee.id).toBe(same.id);
    // Marisol Vance shares a surname and is not joined.
    expect(joined.events.some((e) => e.attendee.id === someoneElse.id)).toBe(false);
  });

  it("tolerates an event that was deleted, since audit records may outlive it", async () => {
    const typed = await createAttendee({
      eventId: "event-gone",
      displayName: "Dr Green",
    });
    const history = await loadHistory(typed);
    expect(history.events).toHaveLength(1);
    expect(history.events[0]!.event).toBeNull();
  });
});
