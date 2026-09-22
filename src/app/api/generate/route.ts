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
 *
 * WHO MAY CALL IT (ADR-0012, `fieldnote-9n1`). Three refusals run before the body is
 * read, in this order, because each is cheaper than the last and none of them needs the
 * payload:
 *
 *   1. A `Content-Type` that is not JSON is refused with 415. Nothing is parsed.
 *   2. A request with no access cookie, or one whose key does not hash to a configured
 *      hash, is refused with 401. With `FIELDNOTE_ACCESS_KEY_HASHES` unset the route
 *      refuses every request and says the variable is undefined: it never falls back to
 *      open. The cookie is set by `/api/access` from a form on the settings screen and is
 *      `HttpOnly`, so no script on the page can read it or send it anywhere.
 *   3. The model key must be present, as before.
 *
 * There is no rate limit in code, by decision. A per-instance counter on a serverless
 * platform is not a ceiling, and the ceiling that matters is a monthly spend limit on the
 * model API key, which is the owner's action in the provider's console (ADR-0012). What
 * the route already does when the provider refuses for rate or spend is unchanged and
 * tested: "the model API is rate limiting" at `tests/unit/generate-route.test.ts`, the
 * rate-limit case.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { GenerateRequest, GenerateResponse } from "@/lib/generation/contract";
import { MAX_RETRIES } from "@/lib/generation/model";
import { applyGuardrails } from "@/lib/generation/guardrails";
import { protectApproved, restoreApproved } from "@/lib/generation/approved";
import { requestModelDraft, textOf } from "@/lib/generation/model-call";
import { resolvePrivateTerms } from "@/lib/private-terms-source";
import { PROMPT_TEMPLATE_VERSION } from "@/lib/generation/prompt";
import { assertPseudonymized, PseudonymizationError } from "@/lib/privacy/pseudonymize";
import {
  ACCESS_COOKIE,
  ACCESS_KEY_HASHES_VARIABLE,
  configuredHashes,
  cookieValue,
  keyMatches,
} from "@/lib/access/key";

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
  passages: z
    .array(z.object({ id: z.string().min(1).max(64), body: z.string().min(1).max(2000) }))
    .max(50),
}) satisfies z.ZodType<GenerateRequest>;

const KEY_VARIABLE = "ANTHROPIC_API_KEY";

/**
 * The private-term rule, loaded once, from `.guardrail-terms.local` if it exists and from
 * `FIELDNOTE_GUARDRAIL_TERMS` otherwise. Absent on every public clone and every CI
 * runner, and said so here rather than assumed: an inactive control that looks active is
 * worse than none. The line carries a status, a count, and which source answered — never
 * a term. See `src/lib/private-terms-source.ts`.
 */
const privateTerms = resolvePrivateTerms();
console.info(
  JSON.stringify({
    route: "generate",
    privateTerms: privateTerms.status,
    count: privateTerms.count,
    source: privateTerms.source,
    // Presence only, never the value, never a length, never a prefix. On 2026-09-22 a
    // model key that had not reached Production was found by someone drafting on a
    // phone, because the route says nothing about it until a request with a valid
    // caller key gets that far. Now both variables the route refuses without announce
    // themselves once, at start-up, where a deployment's logs will show them.
    modelKey: process.env[KEY_VARIABLE] ? "present" : "absent",
  }),
);

/** Metadata only. Every field here is a number, an enum, or an identifier. */
function log(entry: Record<string, string | number | boolean | null>): void {
  console.info(JSON.stringify({ route: "generate", ...entry }));
}

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.split(";")[0]!.trim().toLowerCase() !== "application/json") {
    log({ status: 415, reason: "content-type" });
    return NextResponse.json(
      { error: "Body must be application/json." },
      { status: 415 },
    );
  }

  const hashes = configuredHashes(process.env[ACCESS_KEY_HASHES_VARIABLE]);
  if (hashes.length === 0) {
    // Unconfigured refuses everything. An open route is not a fallback.
    log({
      status: 401,
      reason: "access-unconfigured",
      variable: ACCESS_KEY_HASHES_VARIABLE,
    });
    return NextResponse.json(
      { error: "This route is not accepting callers." },
      {
        status: 401,
      },
    );
  }

  const presented = cookieValue(request.headers.get("cookie"), ACCESS_COOKIE);
  if (!(await keyMatches(presented, hashes))) {
    // One reason for both "no cookie" and "wrong cookie": the answer to a caller who
    // should not be here is the same either way, and the log says which without saying
    // what was presented.
    log({ status: 401, reason: "access-denied", presented: presented !== undefined });
    return NextResponse.json(
      { error: "This device is not authorised." },
      { status: 401 },
    );
  }

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
    // Approved passages are held out of it first (fieldnote-quj): real approved copy
    // carries the product's own name, which is exactly what the private list holds,
    // and a passage the model copied exactly is not the model writing the name.
    const guarded = blocked
      ? { text: "", flagsFired: [] as string[] }
      : (() => {
          const held = protectApproved(textOf(message), parsed.data.passages);
          const result = applyGuardrails(held.text, [privateTerms.rule]);
          return {
            text: restoreApproved(result.text, held.table),
            flagsFired: result.flagsFired,
          };
        })();

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
      passages: parsed.data.passages.length,
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
