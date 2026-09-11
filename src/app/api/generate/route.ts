/**
 * The generation route. The system's only egress, and a stateless pass-through.
 *
 * Plan §5 non-negotiable 2: the route logs metadata, never content. Plan §4.1: what
 * arrives here is pseudonymized on the device; the roster never leaves it, so this route
 * cannot run the roster half of `assertPseudonymized` and runs the structural half as
 * defence in depth behind the client's full check. The key stays here.
 *
 * What this route decides, per the session 5 prompt:
 *
 *   - Transient failures (429, 5xx including 529, connection errors) are retried by the
 *     SDK, `MAX_RETRIES` times.
 *   - `stop_reason: "max_tokens"` is retried once at `TRUNCATION_RETRY_MULTIPLIER` times
 *     the ceiling (in `model-call.ts`, shared with the eval runner). A second truncation
 *     blocks the draft: a cut-off email reads as finished until the end, and it is being
 *     copied into a mail client.
 *   - `stop_reason: "refusal"` blocks the draft. The category is logged; the text is not.
 *
 * The API key is checked for presence, never read into anything that could print it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { GenerateRequest, GenerateResponse } from "@/lib/generation/contract";
import { MAX_RETRIES } from "@/lib/generation/model";
import { applyGuardrails } from "@/lib/generation/guardrails";
import { requestModelDraft, textOf } from "@/lib/generation/model-call";
import { loadPrivateTerms } from "@/lib/generation/private-terms";
import { PROMPT_TEMPLATE_VERSION } from "@/lib/generation/prompt";
import { assertPseudonymized, PseudonymizationError } from "@/lib/privacy/pseudonymize";

/** Never prerendered: this handler exists to be called, not built. */
export const dynamic = "force-dynamic";

/** Matches any token the pseudonymizer emits. Kept in step with `TOKEN_PATTERN`. */
const TOKEN = /^\[(?:HCP|STAFF|PERSON|ROLE)_\d+\]$/;

/** The request, validated here and only here; the type it satisfies is the contract's. */
const GenerateRequestSchema = z.object({
  notes: z.array(z.string().min(1).max(20_000)).min(1).max(50),
  recipientToken: z.string().regex(TOKEN),
  recipientKind: z.enum(["HCP", "STAFF", "PERSON", "ROLE"]),
  priorOpenings: z.array(z.string().max(500)).max(50),
  eventName: z.string().max(200),
}) satisfies z.ZodType<GenerateRequest>;

const KEY_VARIABLE = "ANTHROPIC_API_KEY";

/**
 * The private-term rule, loaded once. Absent on every public clone and every CI runner,
 * and said so here rather than assumed: an inactive control that looks active is worse
 * than none. See the header of `private-terms.ts`.
 */
const privateTerms = loadPrivateTerms();
console.info(
  JSON.stringify({
    route: "generate",
    privateTerms: privateTerms.status,
    count: privateTerms.count,
  }),
);

/** Metadata only. Every field here is a number, an enum, or an identifier. */
function log(entry: Record<string, string | number | boolean | null>): void {
  console.info(JSON.stringify({ route: "generate", ...entry }));
}

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();

  if (!process.env[KEY_VARIABLE]) {
    log({ status: 500, reason: "key-undefined", variable: KEY_VARIABLE });
    return NextResponse.json(
      { error: `${KEY_VARIABLE} is not defined.` },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log({ status: 400, reason: "not-json" });
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    log({ status: 400, reason: "schema", issues: parsed.error.issues.length });
    return NextResponse.json(
      { error: "Body does not match the request schema." },
      { status: 400 },
    );
  }

  // Structural guard only: no roster here, by design.
  try {
    for (const text of [...parsed.data.notes, ...parsed.data.priorOpenings]) {
      assertPseudonymized(text, []);
    }
  } catch (cause) {
    if (!(cause instanceof PseudonymizationError)) throw cause;
    log({ status: 400, reason: "unpseudonymized", detail: cause.message });
    return NextResponse.json(
      { error: "Payload failed the pseudonymization invariant." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ maxRetries: MAX_RETRIES });

  try {
    // The call itself is `model-call.ts`, shared with the eval runner so the two cannot
    // drift: the runner measures exactly what this sends.
    const { message, attempts, ceiling } = await requestModelDraft(client, parsed.data);

    const blocked: GenerateResponse["blocked"] =
      message.stop_reason === "max_tokens"
        ? "truncated"
        : message.stop_reason === "refusal"
          ? "refusal"
          : null;

    // The one rule the server owns: private terms the public ruleset cannot carry.
    const guarded = blocked
      ? { text: "", flagsFired: [] }
      : applyGuardrails(textOf(message), [privateTerms.rule]);

    log({
      status: 200,
      model: message.model,
      stopReason: message.stop_reason,
      refusalCategory: message.stop_details?.category ?? null,
      blocked,
      attempts,
      ceiling,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      notes: parsed.data.notes.length,
      priorOpenings: parsed.data.priorOpenings.length,
      privateTermsFired: guarded.flagsFired.length > 0,
      durationMs: Date.now() - startedAt,
    });

    const response: GenerateResponse = {
      text: guarded.text,
      blocked,
      model: message.model,
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      flagsFired: guarded.flagsFired,
    };
    return NextResponse.json(response);
  } catch (cause) {
    // Typed, most specific first. Status and class only; the SDK's message can quote the
    // request, and the request is content.
    if (cause instanceof Anthropic.AuthenticationError) {
      log({ status: 502, reason: "authentication", upstream: cause.status });
      return NextResponse.json(
        { error: "The model API rejected the key." },
        { status: 502 },
      );
    }
    if (cause instanceof Anthropic.RateLimitError) {
      log({ status: 503, reason: "rate-limited", upstream: cause.status });
      return NextResponse.json(
        { error: "The model API is rate limiting." },
        { status: 503 },
      );
    }
    if (cause instanceof Anthropic.APIError) {
      log({ status: 502, reason: "api-error", upstream: cause.status ?? null });
      return NextResponse.json(
        { error: "The model API returned an error." },
        { status: 502 },
      );
    }
    log({ status: 500, reason: "unexpected", durationMs: Date.now() - startedAt });
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
