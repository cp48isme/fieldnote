/**
 * The generation pipeline, with the network call replaced by a function.
 *
 * What is under test is the order of operations — pseudonymize, guard, request, guardrails,
 * rehydrate — and the batch behaviour: one instance for the whole batch, openings carried
 * forward, one recipient's failure never taking the others down. The model is not here;
 * the injected `requestDraft` returns what a model would, including the two stop reasons
 * the route turns into blocks.
 */

import { describe, expect, it, vi } from "vitest";

import type { EventRecord, NoteRecord } from "@/lib/db";
import type { GenerateRequest, GenerateResponse } from "@/lib/generation/contract";
import { generateDrafts, openingOf, UNKNOWN_TOKEN_FLAG } from "@/lib/generation/pipeline";
import { GAP_MARKER } from "@/lib/generation/prompt";
import { MODEL_ID } from "@/lib/generation/model";
import { ROSTER } from "../fixtures/dictation";

const EVENT: EventRecord = {
  id: "event-fixture",
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 1,
  name: "Northgate mobile lab",
  siteLabel: "",
  startsAt: null,
  status: "active",
};

let noteCounter = 0;
function note(attendeeId: string | null, body: string): NoteRecord {
  noteCounter += 1;
  return {
    id: `note-${noteCounter}`,
    createdAt: noteCounter,
    updatedAt: noteCounter,
    schemaVersion: 1,
    eventId: EVENT.id,
    attendeeId,
    body,
    source: "dictated",
  };
}

/** A model that writes a plain relational email addressed to whoever it was given. */
function answering(text: (request: GenerateRequest) => string) {
  const requests: GenerateRequest[] = [];
  const requestDraft = vi.fn(
    async (request: GenerateRequest): Promise<GenerateResponse> => {
      requests.push(request);
      return {
        text: text(request),
        blocked: null,
        model: MODEL_ID,
        promptTemplateVersion: "1.0.0",
      };
    },
  );
  return { requestDraft, requests };
}

const email = (request: GenerateRequest) =>
  [
    "Subject: Thank you for joining us",
    "",
    `Dear ${request.recipientToken},`,
    "",
    `Thank you for your time on the truck. You mentioned ${request.notes[0]?.includes("[ROLE") ? "[ROLE_1]" : "[STAFF_1]"} would confirm the room size.`,
    "",
    "Kind regards,",
  ].join("\n");

describe("per-person batching", () => {
  it("sends one request per attendee with their notes, oldest first, and skips the rest", async () => {
    const { requestDraft, requests } = answering(email);
    const result = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [
        note("att-2", "Vance wants a second look."),
        note(null, "Someone asked about the trolley height."),
        note("att-2", "Peter Vance confirmed Thursday."),
        note("att-5", ""),
      ],
      requestDraft,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.notes).toHaveLength(2);
    expect(requests[0]!.recipientToken).toMatch(/^\[HCP_\d+\]$/);
    expect(result.unattributedNotes).toBe(1);
    expect(result.drafts).toHaveLength(1);
  });

  it("never lets a name or a role reach the request", async () => {
    const { requestDraft, requests } = answering(email);
    await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [
        note(
          "att-5",
          "Piper wants the kit costed and the biomedical engineer will measure up.",
        ),
        note("att-4", "Dr. Green and the director of finance liked the layout."),
      ],
      requestDraft,
    });
    const everything = JSON.stringify(requests);
    expect(everything).not.toMatch(
      /Piper|Green|biomedical engineer|director of finance/i,
    );
    expect(everything).toContain("[ROLE_1]");
  });

  it("keeps tokens stable across the batch: one instance, one numbering", async () => {
    const { requestDraft, requests } = answering(email);
    await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [
        note("att-2", "Vance liked the layout; Piper is chasing paperwork."),
        note("att-5", "Piper will confirm the room size."),
      ],
      requestDraft,
    });
    // Piper is [STAFF_1] in both requests, and is the second recipient.
    const piperInFirst = requests[0]!.notes[0]!.match(/\[STAFF_\d+\]/)![0];
    expect(requests[1]!.recipientToken).toBe(piperInFirst);
  });

  it("carries each finished draft's opening into the next request", async () => {
    const { requestDraft, requests } = answering(email);
    await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [
        note("att-1", "Asked about the port."),
        note("att-2", "Keen on a live case."),
      ],
      requestDraft,
    });
    expect(requests[0]!.priorOpenings).toEqual([]);
    expect(requests[1]!.priorOpenings).toEqual(["Thank you for your time on the truck."]);
  });

  it("rehydrates the draft with the recipient's name and leaves tokens out of the body", async () => {
    const { requestDraft } = answering(email);
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-5", "Piper wants the kit costed.")],
      requestDraft,
    });
    expect(drafts[0]!.body).toContain("Dear Tomas Piper,");
    expect(drafts[0]!.body).not.toMatch(/\[STAFF_\d+\]/);
    expect(drafts[0]!.blocked).toBeNull();
    expect(drafts[0]!.model).toBe(MODEL_ID);
    expect(drafts[0]!.promptTemplateVersion).toBe("1.0.0");
    expect(drafts[0]!.guardrailRulesetVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("guardrails in the pipeline", () => {
  it("blocks a claim-bearing sentence and leaves the gap visible in the draft", async () => {
    const { requestDraft } = answering(
      (r) =>
        `Dear ${r.recipientToken},\n\nThe system is faster than anything on the market. Thank you for your time.`,
    );
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-2", "He asked if it is faster than what he has now.")],
      requestDraft,
    });
    expect(drafts[0]!.body).toContain(`${GAP_MARKER} Thank you for your time.`);
    expect(drafts[0]!.flagsFired).toEqual(["claim-bearing"]);
  });

  it("flags a token the model invented and leaves it in place", async () => {
    const { requestDraft } = answering(
      (r) => `Dear ${r.recipientToken}, [HCP_9] sends regards.`,
    );
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-2", "Keen.")],
      requestDraft,
    });
    expect(drafts[0]!.body).toContain("[HCP_9]");
    expect(drafts[0]!.flagsFired).toContain(UNKNOWN_TOKEN_FLAG);
  });
});

describe("blocks and failures, one recipient at a time", () => {
  it("blocks a truncated or refused draft with an explanation and keeps going", async () => {
    const requestDraft = vi.fn(async (r: GenerateRequest): Promise<GenerateResponse> => ({
      text: "",
      blocked: r.recipientKind === "HCP" ? "truncated" : "refusal",
      model: MODEL_ID,
      promptTemplateVersion: "1.0.0",
    }));
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-2", "Keen."), note("att-5", "Also keen.")],
      requestDraft,
    });
    expect(drafts.map((d) => d.blocked)).toEqual(["truncated", "refusal"]);
    expect(drafts.every((d) => d.body === "" && d.explanation)).toBe(true);
  });

  it("reports a failed request for that recipient only", async () => {
    const { GenerationRequestError } = await import("@/lib/generation/client");
    let calls = 0;
    const requestDraft = vi.fn(async (r: GenerateRequest): Promise<GenerateResponse> => {
      calls += 1;
      if (calls === 1) throw new GenerationRequestError("down", 503);
      return {
        text: email(r),
        blocked: null,
        model: MODEL_ID,
        promptTemplateVersion: "1.0.0",
      };
    });
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-2", "Keen."), note("att-5", "Also keen.")],
      requestDraft,
    });
    expect(drafts[0]!.blocked).toBe("request-failed");
    expect(drafts[1]!.blocked).toBeNull();
  });

  it("turns a guard failure into a defect report, not a user-facing error", async () => {
    // The guard fires only if the tokenizer has a defect. Simulate one by giving the
    // batch an attendee whose name the tokenizer cannot see but the guard can: the guard
    // checks roster forms case-insensitively with a capital, and a display name that is
    // itself a title-less single word of one letter has no roster form — so instead the
    // defect is simulated the honest way, with a request function that inspects what it
    // was given and a spy on the console.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { assertPseudonymized } = await import("@/lib/privacy/pseudonymize");
    const { PseudonymizationError } = await import("@/lib/privacy/pseudonymize");
    // A prior opening that somehow carries a name is the one input the pipeline guards
    // that did not come through the tokenizer. Reach it by making the first draft's
    // opening line a name-shaped string the ruleset does not catch.
    const requestDraft = vi.fn(async (r: GenerateRequest): Promise<GenerateResponse> => ({
      text: `Dear ${r.recipientToken},\n\nOkonjo-Baptiste sends regards.`,
      blocked: null,
      model: MODEL_ID,
      promptTemplateVersion: "1.0.0",
    }));
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-2", "Keen."), note("att-5", "Also keen.")],
      requestDraft,
    });
    // The first draft is fine; its opening carried a roster name, so the second
    // recipient's guard fired before anything was sent.
    expect(drafts[0]!.blocked).toBeNull();
    expect(drafts[1]!.blocked).toBe("defect");
    expect(drafts[1]!.explanation).toMatch(/defect report/);
    expect(requestDraft).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    // The report carries lengths, never the name.
    expect(String(error.mock.calls[0])).not.toContain("Okonjo-Baptiste");
    expect(() => assertPseudonymized("Okonjo-Baptiste sends regards.", ROSTER)).toThrow(
      PseudonymizationError,
    );
  });
});

describe("openingOf", () => {
  it("skips the subject and the greeting and takes the first sentence", () => {
    expect(
      openingOf(
        "Subject: Hello\n\nDear [HCP_1],\n\nThank you again for your time. It was good to meet.",
      ),
    ).toBe("Thank you again for your time.");
  });

  it("returns null for an empty draft", () => {
    expect(openingOf("")).toBeNull();
  });
});
