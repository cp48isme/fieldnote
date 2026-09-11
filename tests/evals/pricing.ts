/**
 * What one model call costs, from the API's usage fields.
 *
 * Rates are Anthropic's first-party API rates for `claude-opus-5` as cached in the
 * claude-api reference on 2026-06-24: $5 per million input tokens, $25 per million
 * output tokens, cache reads at a tenth of input and cache writes at 1.25 times it. The
 * route sets no `cache_control`, so the cache fields are expected to be zero and are
 * priced anyway so a future change shows up in the figure rather than being missed.
 * If the rates change, this file and the date change together.
 */

import type Anthropic from "@anthropic-ai/sdk";

import { MODEL_ID } from "@/lib/generation/model";

export const PRICING = Object.freeze({
  model: MODEL_ID,
  ratesAsOf: "2026-06-24",
  inputPerMillion: 5,
  outputPerMillion: 25,
  cacheReadPerMillion: 0.5,
  cacheWritePerMillion: 6.25,
});

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function usageOf(message: Anthropic.Message): Usage {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

export const NO_USAGE: Usage = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});

export function costUsd(usage: Usage): number {
  return (
    (usage.inputTokens * PRICING.inputPerMillion +
      usage.outputTokens * PRICING.outputPerMillion +
      usage.cacheReadTokens * PRICING.cacheReadPerMillion +
      usage.cacheWriteTokens * PRICING.cacheWritePerMillion) /
    1_000_000
  );
}
