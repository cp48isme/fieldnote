/**
 * The shared model call: one code path for the route and the eval runner.
 *
 * Two things are asserted. First, structurally, that `messages.create` is called from
 * exactly one file — `src/lib/generation/model-call.ts` — across `src/` and
 * `tests/evals/`, so neither the route nor the runner can grow its own call and drift.
 * Second, behaviourally, with a fake client, that the parameters are the production
 * ones: the versioned system prompt, the user message built from the request, the model
 * id, the effort, and the output ceiling, with the one retry on truncation.
 *
 * Same grep shape as `single-egress.test.ts`, for the same reason.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type Anthropic from "@anthropic-ai/sdk";

import type { GenerateRequest } from "@/lib/generation/contract";
import {
  EFFORT,
  MAX_OUTPUT_TOKENS,
  MODEL_ID,
  TRUNCATION_RETRY_MULTIPLIER,
} from "@/lib/generation/model";
import { buildModelParams, requestModelDraft, textOf } from "@/lib/generation/model-call";
import { buildSystemPrompt, buildUserMessage } from "@/lib/generation/prompt";

const CALL_SITE = "src/lib/generation/model-call.ts";
const MESSAGES_CREATE = /\bmessages\s*\.\s*create\s*\(/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const posix = (path: string) => relative(process.cwd(), path).split(sep).join("/");

const REQUEST: GenerateRequest = {
  notes: ["[HCP_1] asked about mounting time."],
  recipientToken: "[HCP_1]",
  recipientKind: "HCP",
  priorOpenings: [],
  eventName: "Northgate mobile lab",
};

function message(text: string, stop_reason: string): Anthropic.Message {
  return {
    content: [{ type: "text", text }],
    stop_reason,
    model: MODEL_ID,
    usage: { input_tokens: 10, output_tokens: 20 },
  } as unknown as Anthropic.Message;
}

describe("one model call", () => {
  it("is made from exactly one file across src/ and tests/evals/", () => {
    const files = [
      ...walk(join(process.cwd(), "src")),
      ...walk(join(process.cwd(), "tests", "evals")),
    ];
    expect(files.length).toBeGreaterThan(0);
    const callers = files
      .map(posix)
      .filter((f) =>
        MESSAGES_CREATE.test(codeOnly(readFileSync(join(process.cwd(), f), "utf8"))),
      );
    expect(callers).toEqual([CALL_SITE]);
  });

  it("builds the production parameters and nothing else", () => {
    const params = buildModelParams(REQUEST);
    expect(params).toEqual({
      model: MODEL_ID,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserMessage(REQUEST) }],
      output_config: { effort: EFFORT },
    });
  });

  it("sends the ceiling, and retries once at the multiple on truncation", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(message("Thank", "max_tokens"))
      .mockResolvedValueOnce(message("Thank you.", "end_turn"));
    const client = { messages: { create } } as unknown as Anthropic;
    const result = await requestModelDraft(client, REQUEST);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]![0]).toMatchObject({
      ...buildModelParams(REQUEST),
      max_tokens: MAX_OUTPUT_TOKENS,
    });
    expect(create.mock.calls[1]![0].max_tokens).toBe(
      MAX_OUTPUT_TOKENS * TRUNCATION_RETRY_MULTIPLIER,
    );
    expect(result.attempts).toBe(2);
    expect(result.ceiling).toBe(MAX_OUTPUT_TOKENS * TRUNCATION_RETRY_MULTIPLIER);
    expect(textOf(result.message)).toBe("Thank you.");
  });
});
