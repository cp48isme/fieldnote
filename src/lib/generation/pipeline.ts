/**
 * Generation, end to end, on the device side.
 *
 * Per-person batching: one request per attendee carrying every note attributed to them,
 * oldest first. Accumulated openings: each finished draft's opening line is carried into
 * the next request, pseudonymized, so a batch of eight does not open eight identical ways.
 * Token stability across the batch comes from one pseudonymizer instance for the whole
 * batch — a fresh instance per note restarts the numbering and tells the model the same
 * person is eight people.
 *
 * THE ORDER OF OPERATIONS IS THE CONTROL.
 *
 *   1. pseudonymize every note for the recipient (names, roles: ADR-0006, ADR-0007)
 *   2. assertPseudonymized on everything that will cross — the guard on the API client
 *   3. requestDraft — the one network call in this application
 *   4. applyGuardrails on the pseudonymized draft, so a blocked sentence never carried
 *      a name into a log
 *   5. rehydrate, canonical forms, for display
 *
 * WHAT THE REPRESENTATIVE SEES WHEN SOMETHING FAILS. Never a stack trace, and never a
 * whole batch lost to one recipient. Each recipient's draft carries its own outcome:
 *
 *   - `truncated` / `refusal` — the model's stop reason blocked it (route decision).
 *   - `request-failed` — the route could not be reached or answered with an error.
 *   - `defect` — `assertPseudonymized` threw. ADR-0006 assigns this session one job:
 *     that throw is an internal invariant, so it surfaces as a defect report to the
 *     developer (a console error with lengths, never text) and as one skipped draft to
 *     the representative, not as a failure of the tool. The rest of the batch continues.
 *
 * NOTHING IS PERSISTED HERE. Session 5 generates without audit records, so drafts are
 * held in memory and never written to Dexie: a `DraftRecord` with no `AuditRecord`
 * beside it is the shape CLAUDE.md's working agreement forbids, and session 6 adds both
 * in one change. The build guide's session 5 and 6 entries record the suspension.
 */

import type { AttendeeRecord, EventRecord, Id, NoteRecord } from "@/lib/db";
import {
  assertPseudonymized,
  createPseudonymizer,
  PseudonymizationError,
  TOKEN_PATTERN,
  type TokenKind,
} from "@/lib/privacy/pseudonymize";

import { GenerationRequestError, requestDraft as defaultRequestDraft } from "./client";
import type { GenerateRequest } from "./contract";
import { applyGuardrails, GUARDRAIL_RULESET_VERSION } from "./guardrails";
import { MODEL_ID } from "./model";
import { PROMPT_TEMPLATE_VERSION } from "./prompt";
import type { RequestDraft } from "./client";

export type BlockReason = "truncated" | "refusal" | "request-failed" | "defect";

/** Flag ids the pipeline adds beside the ruleset's own. */
export const UNKNOWN_TOKEN_FLAG = "unknown-token";

export interface DraftOutcome {
  attendeeId: Id;
  recipientToken: string;
  /** Rehydrated, guarded text. Empty when blocked. */
  body: string;
  blocked: BlockReason | null;
  /** One sentence for the representative when blocked. */
  explanation: string | null;
  /** Rule ids that fired, for the audit record session 6 will write. */
  flagsFired: string[];
  /** What the audit schema needs to cite. */
  model: string;
  promptTemplateVersion: string;
  guardrailRulesetVersion: string;
}

export interface BatchInput {
  event: EventRecord;
  attendees: readonly AttendeeRecord[];
  notes: readonly NoteRecord[];
  /** Injected for tests; the real one is the API client. */
  requestDraft?: RequestDraft;
}

export interface BatchResult {
  drafts: DraftOutcome[];
  /** Notes with no attendee cannot be drafted for anyone. Reported, not silently dropped. */
  unattributedNotes: number;
}

const BLOCK_EXPLANATIONS: Record<BlockReason, string> = {
  truncated:
    "The draft came back cut off twice. It is withheld rather than shown, because a cut-off email reads as finished until the end.",
  refusal: "The model declined to draft this one. Nothing was generated.",
  "request-failed":
    "The draft could not be requested. Check the connection and try again.",
  defect:
    "This draft was skipped. A defect report has been logged for the developer; nothing was sent.",
};

function kindOf(token: string): TokenKind {
  const kind = token.slice(1, token.indexOf("_"));
  return kind as TokenKind;
}

/**
 * The opening line of a draft: the first sentence of the first paragraph after the subject
 * and the greeting. Taken from the guarded, pseudonymized text, so an opening carries no
 * name and no blocked sentence into the next request.
 */
export function openingOf(draft: string): string | null {
  const lines = draft
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^subject:/i.test(l));
  const greeting = (line: string) => /,$/.test(line) && line.split(/\s+/).length <= 8;
  const first = lines.find((line) => !greeting(line));
  if (!first) return null;
  return first.split(/(?<=[.!?])\s+/)[0] ?? null;
}

export async function generateDrafts(input: BatchInput): Promise<BatchResult> {
  const requestDraft = input.requestDraft ?? defaultRequestDraft;
  const pseudonymizer = createPseudonymizer(input.attendees);

  const notesByAttendee = new Map<Id, NoteRecord[]>();
  let unattributedNotes = 0;
  for (const note of [...input.notes].sort((a, b) => a.createdAt - b.createdAt)) {
    if (note.attendeeId === null) {
      unattributedNotes += 1;
      continue;
    }
    if (note.body.trim().length === 0) continue;
    notesByAttendee.set(note.attendeeId, [
      ...(notesByAttendee.get(note.attendeeId) ?? []),
      note,
    ]);
  }

  const drafts: DraftOutcome[] = [];
  const priorOpenings: string[] = [];

  for (const attendee of input.attendees) {
    const notes = notesByAttendee.get(attendee.id);
    if (!notes) continue;

    const recipientToken = pseudonymizer.tokenForAttendee(attendee);
    const base = {
      attendeeId: attendee.id,
      recipientToken,
      model: MODEL_ID,
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      guardrailRulesetVersion: GUARDRAIL_RULESET_VERSION,
    };
    const blockedOutcome = (blocked: BlockReason): DraftOutcome => ({
      ...base,
      body: "",
      blocked,
      explanation: BLOCK_EXPLANATIONS[blocked],
      flagsFired: [],
    });

    let request: GenerateRequest;
    try {
      const pseudonymized = notes.map((note) => pseudonymizer.pseudonymize(note.body));
      for (const text of [...pseudonymized, ...priorOpenings]) {
        assertPseudonymized(text, input.attendees);
      }
      request = {
        notes: pseudonymized,
        recipientToken,
        recipientKind: kindOf(recipientToken),
        priorOpenings: [...priorOpenings],
        eventName: input.event.name,
      };
    } catch (cause) {
      if (!(cause instanceof PseudonymizationError)) throw cause;
      // The defect report. The message carries lengths, never text — see the guard.
      console.error(
        `[fieldnote] pseudonymization invariant failed for one recipient; the draft was skipped. ${cause.message}`,
      );
      drafts.push(blockedOutcome("defect"));
      continue;
    }

    let response;
    try {
      response = await requestDraft(request);
    } catch (cause) {
      if (!(cause instanceof GenerationRequestError)) throw cause;
      drafts.push(blockedOutcome("request-failed"));
      continue;
    }

    if (response.blocked) {
      drafts.push({ ...blockedOutcome(response.blocked), model: response.model });
      continue;
    }

    const guarded = applyGuardrails(response.text);
    const flagsFired = [...guarded.flagsFired];
    for (const token of guarded.text.match(TOKEN_PATTERN) ?? []) {
      if (!pseudonymizer.mapping.has(token) && !flagsFired.includes(UNKNOWN_TOKEN_FLAG)) {
        // Left in place rather than failed, per ADR-0006: one odd string, not a lost draft.
        flagsFired.push(UNKNOWN_TOKEN_FLAG);
      }
    }

    const opening = openingOf(guarded.text);
    if (opening) priorOpenings.push(opening);

    drafts.push({
      ...base,
      model: response.model,
      body: pseudonymizer.rehydrate(guarded.text),
      blocked: null,
      explanation: null,
      flagsFired,
    });
  }

  return { drafts, unattributedNotes };
}
