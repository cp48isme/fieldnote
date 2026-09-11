/**
 * The one model call. Shared by the generation route and the eval runner, so that what
 * the runner measures is what production sends.
 *
 * Session 7 extracted this from `route.ts`. The runner has to reach the model directly —
 * through the route it would only see post-guardrail text, which hides the prompt-level
 * rate it exists to measure — and a second copy of the call would drift from the first
 * without anyone noticing. So the parameters are built in one place, the truncation retry
 * lives in one place, and `tests/unit/model-call.test.ts` asserts that `messages.create`
 * appears nowhere else in `src/` or `tests/evals/`.
 *
 * What is decided here, per the session 5 prompt: `stop_reason: "max_tokens"` is retried
 * once at `TRUNCATION_RETRY_MULTIPLIER` times the ceiling; a second truncation is the
 * caller's to block. Transient failures are the SDK's to retry (`MAX_RETRIES`, set on the
 * client by the caller). The key is the caller's too: this module never reads it.
 */

import type Anthropic from "@anthropic-ai/sdk";

import type { GenerateRequest } from "./contract";
import {
  EFFORT,
  MAX_OUTPUT_TOKENS,
  MODEL_ID,
  TRUNCATION_RETRY_MULTIPLIER,
} from "./model";
import { buildSystemPrompt, buildUserMessage } from "./prompt";

/** Everything but the output ceiling, which the retry changes. */
export function buildModelParams(
  request: GenerateRequest,
): Omit<Anthropic.MessageCreateParamsNonStreaming, "max_tokens"> {
  return {
    model: MODEL_ID,
    system: buildSystemPrompt(),
    messages: [{ role: "user" as const, content: buildUserMessage(request) }],
    output_config: { effort: EFFORT },
  };
}

export interface ModelDraft {
  message: Anthropic.Message;
  /** 1, or 2 when the first answer truncated and was retried. */
  attempts: number;
  /** The ceiling the returned message was produced under. */
  ceiling: number;
}

export async function requestModelDraft(
  client: Anthropic,
  request: GenerateRequest,
): Promise<ModelDraft> {
  const params = buildModelParams(request);

  let ceiling = MAX_OUTPUT_TOKENS;
  let message = await client.messages.create({ ...params, max_tokens: ceiling });
  let attempts = 1;

  if (message.stop_reason === "max_tokens") {
    ceiling *= TRUNCATION_RETRY_MULTIPLIER;
    message = await client.messages.create({ ...params, max_tokens: ceiling });
    attempts += 1;
  }

  return { message, attempts, ceiling };
}

/** The text blocks of a message, joined. Thinking blocks are not text and are skipped. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
