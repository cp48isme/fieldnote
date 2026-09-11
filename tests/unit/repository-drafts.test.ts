/**
 * The adversarial cases for session 6's invariants, against the repository with a fake
 * database (see `support/fake-database.ts` for why not a real one).
 *
 *   1. No draft without its audit record. The audit write is made to fail; no draft
 *      exists afterwards. Then the draft write is made to fail; no audit record exists
 *      afterwards either, because the transaction rolled it back.
 *   2. Export is impossible from `generated`.
 *   3. A blocked draft cannot reach `exported` — nor `reviewed`, nor be edited.
 *   4. Deleting an event spares its audit records (ADR-0008).
 *   5. The audit record's export fields are written once.
 *
 * Each has a counterfactual, named in its comment, that was run while writing this file.
 * All data is synthetic, per ADR-0001.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DraftStateError,
  createAttendee,
  createDraftWithAudit,
  createEvent,
  deleteEvent,
  exportDraft,
  getAuditRecordForDraft,
  getDraft,
  listAuditRecords,
  listDrafts,
  markReviewed,
  saveDraftBody,
  type NewDraftInput,
} from "@/lib/db";
import { setDatabase } from "@/lib/db/database";

import { FakeDatabase } from "./support/fake-database";

let db: FakeDatabase;

beforeEach(() => {
  db = new FakeDatabase();
  setDatabase(db.asDatabase());
});

afterEach(() => {
  setDatabase(null);
});

const GENERATED = [
  "Subject: Thank you for joining us",
  "",
  "Dear Dr. Okonjo-Baptiste,",
  "",
  "Thank you for your time on the truck. [approved content required]",
  "",
  "Kind regards,",
].join("\n");

function draftInput(overrides: Partial<NewDraftInput> = {}): NewDraftInput {
  return {
    eventId: "event-1",
    attendeeId: "att-1",
    body: GENERATED,
    blocked: null,
    flagsFired: ["claim-bearing"],
    model: "claude-opus-5",
    promptTemplateVersion: "1.0.0",
    guardrailRulesetVersion: "1.1.0",
    inputHash: "a".repeat(64),
    outputHash: "b".repeat(64),
    ...overrides,
  };
}

describe("no draft without its audit record", () => {
  it("writes both, and the record points at the draft", async () => {
    const { draft, audit } = await createDraftWithAudit(draftInput());
    expect(draft.state).toBe("generated");
    expect(draft.generatedBody).toBe(GENERATED);
    expect(draft.flagsFired).toEqual(["claim-bearing"]);
    expect(audit.draftId).toBe(draft.id);
    expect(audit.reviewedAt).toBeNull();
    expect(audit.exportedAt).toBeNull();
    expect(audit.humanEdited).toBeNull();
    expect(audit.editDistance).toBeNull();
    expect(await getAuditRecordForDraft(draft.id)).toEqual(audit);
  });

  it("writes no draft when the audit write fails", async () => {
    // Counterfactual: write the draft before the audit record outside a transaction,
    // and this finds a draft with no record.
    db.auditRecords.failNextWrite = new Error("quota exceeded");
    await expect(createDraftWithAudit(draftInput())).rejects.toThrow("quota exceeded");
    expect(await listDrafts("event-1")).toEqual([]);
    expect(await listAuditRecords()).toEqual([]);
  });

  it("rolls the audit record back when the draft write fails", async () => {
    db.drafts.failNextWrite = new Error("quota exceeded");
    await expect(createDraftWithAudit(draftInput())).rejects.toThrow("quota exceeded");
    expect(await listAuditRecords()).toEqual([]);
  });

  it("has no write path for a draft alone", async () => {
    const surface = await import("@/lib/db");
    expect("createDraft" in surface).toBe(false);
    expect("putDraft" in surface).toBe(false);
  });
});

describe("export is impossible from generated", () => {
  it("refuses, and leaves both records untouched", async () => {
    // Counterfactual: remove `assertTransition` from `exportDraft`, or add "exported"
    // to `generated`'s transitions, and this exports a draft nobody opened.
    const { draft } = await createDraftWithAudit(draftInput());
    await expect(exportDraft(draft.id, GENERATED)).rejects.toThrow(DraftStateError);
    expect((await getDraft(draft.id))?.state).toBe("generated");
    expect((await getAuditRecordForDraft(draft.id))?.exportedAt).toBeNull();
  });

  it("walks generated → reviewed → exported and measures the edit", async () => {
    const { draft } = await createDraftWithAudit(draftInput());
    const reviewed = await markReviewed(draft.id);
    expect(reviewed.draft.state).toBe("reviewed");
    expect(reviewed.audit.reviewedAt).not.toBeNull();

    const edited = GENERATED.replace(
      "[approved content required]",
      "I will send the room dimensions on Monday.",
    );
    await saveDraftBody(draft.id, edited);
    const exported = await exportDraft(draft.id, edited);
    expect(exported.draft.state).toBe("exported");
    expect(exported.draft.body).toBe(edited);
    expect(exported.draft.generatedBody).toBe(GENERATED);
    expect(exported.audit.exportedAt).not.toBeNull();
    expect(exported.audit.humanEdited).toBe(true);
    expect(exported.audit.editDistance).toBeGreaterThan(0);
  });

  it("records a verbatim export as unedited, distance zero", async () => {
    const { draft } = await createDraftWithAudit(draftInput());
    await markReviewed(draft.id);
    const { audit } = await exportDraft(draft.id, GENERATED);
    expect(audit.humanEdited).toBe(false);
    expect(audit.editDistance).toBe(0);
  });

  it("refuses to review twice or export twice", async () => {
    const { draft } = await createDraftWithAudit(draftInput());
    await markReviewed(draft.id);
    await expect(markReviewed(draft.id)).rejects.toThrow(DraftStateError);
    const first = await exportDraft(draft.id, GENERATED);
    await expect(exportDraft(draft.id, "something else")).rejects.toThrow(
      DraftStateError,
    );
    // Counterfactual for the second check: with the state check removed, the
    // already-carries-an-export check still refuses.
    expect((await getAuditRecordForDraft(draft.id))?.exportedAt).toBe(
      first.audit.exportedAt,
    );
  });

  it("refuses edits after export; the body is the record of what was sent", async () => {
    const { draft } = await createDraftWithAudit(draftInput());
    await markReviewed(draft.id);
    await exportDraft(draft.id, GENERATED);
    await expect(saveDraftBody(draft.id, "changed")).rejects.toThrow(/cannot be edited/);
    expect((await getDraft(draft.id))?.body).toBe(GENERATED);
  });
});

describe("a blocked draft persists and can never be exported", () => {
  const BLOCKED = draftInput({
    body: "",
    blocked: "output-blocked",
    outputHash: "c".repeat(64),
  });

  it("persists with its reason and its record", async () => {
    const { draft, audit } = await createDraftWithAudit(BLOCKED);
    expect(draft.state).toBe("blocked");
    expect(draft.blocked).toBe("output-blocked");
    expect(draft.body).toBe("");
    expect(audit.blocked).toBe("output-blocked");
    expect(audit.outputHash).toBe("c".repeat(64));
  });

  it("cannot be reviewed, edited, or exported, by any route", async () => {
    // Counterfactual: give `blocked` any outgoing transition in `draft-state.ts`, or
    // make the review surface's open path call `markReviewed` on it, and one of these
    // passes a blocked draft toward export.
    const { draft } = await createDraftWithAudit(BLOCKED);
    await expect(markReviewed(draft.id)).rejects.toThrow(DraftStateError);
    await expect(saveDraftBody(draft.id, "x")).rejects.toThrow(/cannot be edited/);
    await expect(exportDraft(draft.id, "")).rejects.toThrow(DraftStateError);
    expect((await getDraft(draft.id))?.state).toBe("blocked");
    expect((await getAuditRecordForDraft(draft.id))?.exportedAt).toBeNull();
  });

  it("refuses a blocked draft carrying a body", async () => {
    await expect(
      createDraftWithAudit(draftInput({ body: "text", blocked: "refusal" })),
    ).rejects.toThrow(/no body/);
  });
});

describe("audit records survive event deletion (ADR-0008)", () => {
  it("deletes the event, its attendees, and its drafts, and keeps the records", async () => {
    // Counterfactual: add `db.auditRecords.where("eventId").equals(id).delete()` to
    // `deleteEvent`, and the record count below is zero.
    const event = await createEvent({ name: "Northgate demonstration day" });
    const attendee = await createAttendee({
      eventId: event.id,
      displayName: "Dr. Vance",
    });
    const { draft, audit } = await createDraftWithAudit(
      draftInput({ eventId: event.id, attendeeId: attendee.id }),
    );

    await deleteEvent(event.id);

    expect(await getDraft(draft.id)).toBeUndefined();
    expect(await listDrafts(event.id)).toEqual([]);
    const surviving = await listAuditRecords();
    expect(surviving).toHaveLength(1);
    expect(surviving[0]!.id).toBe(audit.id);
    expect(surviving[0]!.eventId).toBe(event.id);
  });

  it("lists orphaned records beside live ones, oldest first", async () => {
    const gone = await createEvent({ name: "Halewood" });
    const kept = await createEvent({ name: "Carrowmore" });
    const first = await createDraftWithAudit(draftInput({ eventId: gone.id }));
    const second = await createDraftWithAudit(draftInput({ eventId: kept.id }));
    await deleteEvent(gone.id);
    const all = await listAuditRecords();
    expect(all.map((record) => record.id)).toEqual([first.audit.id, second.audit.id]);
  });
});
