/**
 * Migration v7, run against the fake database: a draft written before the pre-event
 * email is a follow-up; an event gains an empty address and coordinates; an audit record
 * written by a model keeps its model.
 */

import type { Transaction } from "dexie";
import { describe, expect, it } from "vitest";

import {
  MIGRATIONS,
  type AuditRecordRecord,
  type DraftRecord,
  type EventRecord,
} from "@/lib/db";

import { FakeDatabase } from "./support/fake-database";

type V6Draft = Omit<DraftRecord, "kind">;
type V6Event = Omit<
  EventRecord,
  "address" | "coordinates" | "endsAt" | "forwardableEnabled"
>;

const draft: V6Draft = {
  id: "draft-1",
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 6,
  eventId: "event-1",
  attendeeId: "att-1",
  body: "Dear Dr. Vance,\n\nThank you.",
  generatedBody: "Dear Dr. Vance,\n\nThank you.",
  state: "reviewed",
  blocked: null,
  flagsFired: [],
  promptTemplateVersion: "1.2.0",
  guardrailRulesetVersion: "1.3.0",
};

const event: V6Event = {
  id: "event-1",
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 6,
  name: "Northgate demonstration day",
  siteLabel: "Bay 3",
  startsAt: null,
  status: "active",
  objectives: "",
  configuration: "",
  itinerary: "",
  logistics: "Park at the north gate.",
  contingency: "",
};

const audit: AuditRecordRecord = {
  id: "rec-1",
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 5,
  draftId: "draft-1",
  eventId: "event-1",
  model: "claude-opus-5",
  promptTemplateVersion: "1.2.0",
  guardrailRulesetVersion: "1.3.0",
  inputHash: "a".repeat(64),
  outputHash: "b".repeat(64),
  flagsFired: [],
  blocked: null,
  reviewedAt: 1,
  exportedAt: null,
  humanEdited: null,
  editDistance: null,
  passagesUsed: [],
  libraryVersion: null,
};

describe("migration v7", () => {
  it("backfills follow-up on drafts and empty location on events, and leaves audit records alone", async () => {
    const migration = MIGRATIONS.find((m) => m.version === 7);
    expect(migration?.upgrade).toBeDefined();
    const db = new FakeDatabase();
    await db.drafts.put(draft);
    await db.events.put(event);
    await db.auditRecords.put(audit);
    await migration!.upgrade!(db as unknown as Transaction);

    const upgradedDraft = db.drafts.rows.get("draft-1") as unknown as DraftRecord;
    expect(upgradedDraft.kind).toBe("follow-up");
    expect(upgradedDraft.state).toBe("reviewed");
    expect(upgradedDraft.schemaVersion).toBe(7);

    const upgradedEvent = db.events.rows.get("event-1") as unknown as EventRecord;
    expect(upgradedEvent.address).toBe("");
    expect(upgradedEvent.coordinates).toBe("");
    expect(upgradedEvent.logistics).toBe("Park at the north gate.");
    expect(upgradedEvent.schemaVersion).toBe(7);

    const untouched = db.auditRecords.rows.get("rec-1") as unknown as AuditRecordRecord;
    expect(untouched.model).toBe("claude-opus-5");
    expect(untouched.promptTemplateVersion).toBe("1.2.0");
    expect(untouched.schemaVersion).toBe(5);
  });
});
