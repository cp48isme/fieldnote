/**
 * The eval runner: one corpus case through the real pipeline against the live model.
 *
 * HOW IT REACHES THE MODEL. Directly, through the SDK, via the same `requestModelDraft`
 * the generation route calls — so the request is byte-for-byte what production sends
 * (`tests/unit/model-call.test.ts` holds that). It does not go through the route,
 * because the route returns post-guardrail text and the prompt-level rate is what the
 * model wrote before any rule ran. The route's one server-side rule, the private-term
 * rule, is not applied here: it is absent on every public clone and every runner.
 *
 * WHAT IS MEASURED, per sample:
 *
 *   - `producedViolation` — the case's own detector on the model's raw text. The
 *     prompt-level result. This is `fieldnote-08m`'s number.
 *   - `rulesetCaught` — for a produced violation with an expected flag: the flag fired
 *     and the detector no longer matches the guarded text. Null when nothing was
 *     produced (nothing to catch) or the class has no rule (injection).
 *   - `reachedDraft` — the detector on what the representative would see: the pipeline's
 *     rehydrated, guarded, greeted body. The combined result, and the gate.
 *
 * The pipeline itself is `generateDrafts` with the live call injected where the tests
 * inject a function, so pseudonymization, the guard on both sides, the guardrails, and
 * the greeting are the production ones.
 *
 * NONDETERMINISM. `samples` calls per case, default one. A case that passes on one
 * sample and fails on another is a finding about the prompt, and the runner reports
 * every sample rather than a majority: the gate fails if any sample reaches the draft.
 */

import type Anthropic from "@anthropic-ai/sdk";

import type { AttendeeRecord, EventRecord, NoteRecord } from "@/lib/db";
import type { GenerateResponse } from "@/lib/generation/contract";
import {
  applyGuardrails,
  RULESET,
  type GuardrailRule,
} from "@/lib/generation/guardrails";
import { requestModelDraft, textOf } from "@/lib/generation/model-call";
import { generateDrafts, type BlockReason } from "@/lib/generation/pipeline";
import { PROMPT_TEMPLATE_VERSION } from "@/lib/generation/prompt";

import { ROSTER, type EvalCase, type ViolationClass } from "./corpus";
import { NO_USAGE, addUsage, usageOf, type Usage } from "./pricing";

const EVENT: EventRecord = {
  id: "event-evals",
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 2,
  name: "Northgate demonstration day",
  siteLabel: "",
  startsAt: null,
  status: "active",
};

export interface SampleResult {
  /** The model's text, pseudonymized, before any rule ran. Never contains a roster name. */
  modelText: string;
  stopReason: string | null;
  blocked: BlockReason | null;
  producedViolation: boolean;
  rulesetCaught: boolean | null;
  flagsFired: string[];
  reachedDraft: boolean;
  attempts: number;
  usage: Usage;
}

export interface CaseResult {
  id: string;
  class: ViolationClass;
  provenance: EvalCase["provenance"];
  samples: SampleResult[];
}

export interface Judgement {
  producedViolation: boolean;
  rulesetCaught: boolean | null;
  /** Whether the violation survives the ruleset — what would reach a draft. */
  wouldReachDraft: boolean;
}

/**
 * The judging logic, on its own so `tests/unit/evals-gate.test.ts` can run it against
 * a weakened ruleset with no model: the counterfactual that a removed rule lets a
 * violation through to the draft. `runSample` uses it for the first two results and
 * takes the third from the pipeline's real draft.
 */
export function judge(
  evalCase: EvalCase,
  modelText: string,
  ruleset: readonly GuardrailRule[] = RULESET,
): Judgement {
  const producedViolation = modelText.length > 0 && evalCase.violation(modelText);
  const guarded = applyGuardrails(modelText, ruleset);
  const rulesetCaught =
    producedViolation && evalCase.expectedFlag !== null
      ? guarded.flagsFired.includes(evalCase.expectedFlag) &&
        !evalCase.violation(guarded.text)
      : null;
  return {
    producedViolation,
    rulesetCaught,
    wouldReachDraft: producedViolation && evalCase.violation(guarded.text),
  };
}

function notesFor(evalCase: EvalCase): NoteRecord[] {
  return evalCase.notes.map((body, index) => ({
    id: `${evalCase.id}-note-${index + 1}`,
    createdAt: index + 1,
    updatedAt: index + 1,
    schemaVersion: 2,
    eventId: EVENT.id,
    attendeeId: evalCase.recipientId,
    body,
    source: "dictated" as const,
  }));
}

export async function runSample(
  client: Anthropic,
  evalCase: EvalCase,
  attendees: readonly AttendeeRecord[] = ROSTER,
): Promise<SampleResult> {
  let modelText = "";
  let stopReason: string | null = null;
  let attempts = 0;
  let usage = NO_USAGE;

  const live = async (
    request: Parameters<typeof requestModelDraft>[1],
  ): Promise<GenerateResponse> => {
    const result = await requestModelDraft(client, request);
    modelText = textOf(result.message);
    stopReason = result.message.stop_reason;
    attempts = result.attempts;
    usage = addUsage(usage, usageOf(result.message));
    const blocked =
      result.message.stop_reason === "max_tokens"
        ? "truncated"
        : result.message.stop_reason === "refusal"
          ? "refusal"
          : null;
    return {
      text: blocked ? "" : modelText,
      blocked,
      model: result.message.model,
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      flagsFired: [],
    };
  };

  const { drafts } = await generateDrafts({
    event: EVENT,
    attendees,
    notes: notesFor(evalCase),
    requestDraft: live,
  });
  const draft = drafts[0];
  if (!draft) throw new Error(`${evalCase.id}: the pipeline produced no draft`);

  const { producedViolation, rulesetCaught } = judge(evalCase, modelText);
  // The gate reads the real draft — rehydrated, guarded, greeted — not the judgement's
  // reconstruction of it, so nothing between the ruleset and the screen is assumed.
  const reachedDraft = draft.blocked === null && evalCase.violation(draft.body);

  return {
    modelText,
    stopReason,
    blocked: draft.blocked,
    producedViolation,
    rulesetCaught,
    flagsFired: draft.flagsFired,
    reachedDraft,
    attempts,
    usage,
  };
}

export async function runCase(
  client: Anthropic,
  evalCase: EvalCase,
  samples: number,
): Promise<CaseResult> {
  const results: SampleResult[] = [];
  for (let i = 0; i < samples; i += 1) {
    results.push(await runSample(client, evalCase));
  }
  return {
    id: evalCase.id,
    class: evalCase.class,
    provenance: evalCase.provenance,
    samples: results,
  };
}
