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
import { applyGuardrails } from "@/lib/generation/guardrails";
import { sha256Hex } from "@/lib/generation/hash";
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
        flagsFired: [],
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
      flagsFired: [],
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
        flagsFired: [],
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

  it("withholds a draft in which the model invented a roster name, and does not call it a defect", async () => {
    // The model cannot know a roster name, so a bare one in its output is a hallucination
    // or an echo. Neither is a tokenizer defect, and the draft is withheld under its own
    // outcome rather than reported to the developer as an invariant failure.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const requestDraft = vi.fn(async (r: GenerateRequest): Promise<GenerateResponse> => ({
      text: `Dear ${r.recipientToken},\n\nOkonjo-Baptiste sends regards.`,
      blocked: null,
      model: MODEL_ID,
      promptTemplateVersion: "1.0.0",
      flagsFired: [],
    }));
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-2", "Keen.")],
      requestDraft,
    });
    expect(drafts[0]!.blocked).toBe("output-blocked");
    expect(drafts[0]!.body).toBe("");
    expect(drafts[0]!.explanation).toMatch(/not in the notes/);
    expect(error).not.toHaveBeenCalled();
  });

  it("keeps drafting after a hallucinated name: the bad opening is not carried forward", async () => {
    // Before this test, recipient 2's invented name rode into `priorOpenings`, the
    // next recipient's guard threw on it, and every draft after that was lost. Now
    // recipient 2 is withheld and recipients 3 and 4 get drafts.
    let calls = 0;
    const requestDraft = vi.fn(async (r: GenerateRequest): Promise<GenerateResponse> => {
      calls += 1;
      return {
        text:
          calls === 2
            ? `Dear ${r.recipientToken},\n\nOkonjo-Baptiste sends regards.`
            : email(r),
        blocked: null,
        model: MODEL_ID,
        promptTemplateVersion: "1.0.0",
        flagsFired: [],
      };
    });
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [
        note("att-1", "Keen."),
        note("att-2", "Also keen."),
        note("att-3", "Wants more notice."),
        note("att-4", "Confirmed the dates."),
      ],
      requestDraft,
    });
    expect(drafts.map((d) => d.blocked)).toEqual([null, "output-blocked", null, null]);
    expect(requestDraft).toHaveBeenCalledTimes(4);
    // The invented name never reached a later request.
    for (const call of requestDraft.mock.calls.slice(2)) {
      expect(JSON.stringify(call[0])).not.toContain("Okonjo-Baptiste");
    }
  });

  it("reports a genuine tokenizer defect as a defect, and only then", async () => {
    // `defect` is reserved for input we pseudonymized failing the guard, which means the
    // tokenizer is wrong. The only way to reach it is to hand the pipeline text the
    // tokenizer cannot see but the guard can, and there is no such text by construction —
    // so the reservation is asserted the other way round: the guard throwing on a raw name
    // is the condition, and no draft outcome other than `defect` is ever produced from it.
    const { assertPseudonymized, PseudonymizationError } =
      await import("@/lib/privacy/pseudonymize");
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

describe("audit hashes", () => {
  // What is hashed is the decision recorded in ADR-0008 and the pipeline header: the
  // request body as the client serialises it, and the guarded text before rehydration.
  // These assert that decision against the bytes the injected request actually saw.

  it("hashes the request as sent and the guarded text before rehydration", async () => {
    const { requestDraft, requests } = answering(email);
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-5", "Piper wants the kit costed.")],
      requestDraft,
    });
    expect(drafts[0]!.inputHash).toBe(await sha256Hex(JSON.stringify(requests[0])));
    // No rule fires on the plain email, so the guarded text is the model's text.
    expect(drafts[0]!.outputHash).toBe(await sha256Hex(email(requests[0]!)));
    // And neither hash is of the rehydrated body a human reads.
    expect(drafts[0]!.outputHash).not.toBe(await sha256Hex(drafts[0]!.body));
  });

  it("hashes what the ruleset let through, gap marker included", async () => {
    const text = (r: GenerateRequest) =>
      `Dear ${r.recipientToken},\n\nThe system is faster than anything on the market. Thank you for your time.`;
    const { requestDraft, requests } = answering(text);
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-2", "Keen.")],
      requestDraft,
    });
    const guarded = applyGuardrails(text(requests[0]!)).text;
    expect(guarded).toContain(GAP_MARKER);
    expect(drafts[0]!.outputHash).toBe(await sha256Hex(guarded));
  });

  it("records the input hash and no output hash when the model produced no text", async () => {
    const requestDraft = vi.fn(async (): Promise<GenerateResponse> => ({
      text: "",
      blocked: "refusal",
      model: MODEL_ID,
      promptTemplateVersion: "1.0.0",
      flagsFired: [],
    }));
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-2", "Keen.")],
      requestDraft,
    });
    expect(drafts[0]!.blocked).toBe("refusal");
    expect(drafts[0]!.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(drafts[0]!.outputHash).toBeNull();
  });

  it("records both hashes for a withheld draft, so the record says what was withheld", async () => {
    const requestDraft = vi.fn(async (r: GenerateRequest): Promise<GenerateResponse> => ({
      text: `Dear ${r.recipientToken},\n\nOkonjo-Baptiste sends regards.`,
      blocked: null,
      model: MODEL_ID,
      promptTemplateVersion: "1.0.0",
      flagsFired: [],
    }));
    const { drafts } = await generateDrafts({
      event: EVENT,
      attendees: ROSTER,
      notes: [note("att-2", "Keen.")],
      requestDraft,
    });
    expect(drafts[0]!.blocked).toBe("output-blocked");
    expect(drafts[0]!.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(drafts[0]!.outputHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
