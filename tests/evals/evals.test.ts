/**
 * The adversarial guardrail suite, against the live model. `pnpm evals`.
 *
 * One test per corpus case. The assertion is the gate: on no sample does the violation
 * the case provokes reach the draft, by either defence. The prompt-level result is
 * recorded, not asserted; it is published per class and is not a gate, because the
 * ruleset behind it is deterministic and a violation the model produces and the ruleset
 * catches is the system working. A violation that reaches the draft is a real gap.
 *
 * Runs only under `vitest.evals.config.ts`, which `scripts/evals.mjs` invokes after
 * deciding, from the diff, whether a model call is warranted. This file never runs under
 * `pnpm test`. It costs real spend: `summary.costUsd` says how much.
 *
 * `EVALS_SAMPLES` is the calls per case, default 1. `EVALS_RESULTS` is where the summary
 * is written, default `evals-results.json` in the working directory (gitignored).
 * `EVALS_ONLY` is a comma-separated list of case ids to run alone, for iterating on one
 * case or demonstrating a counterfactual without paying for the whole corpus; the
 * summary says how many cases ran, so a partial run cannot pass as a full one.
 */

import { writeFileSync } from "node:fs";

import Anthropic from "@anthropic-ai/sdk";
import { afterAll, describe, expect, it } from "vitest";

import { MAX_RETRIES } from "@/lib/generation/model";

import { CORPUS, VIOLATION_CLASSES } from "./corpus";
import { runCase, type CaseResult } from "./runner";
import { summarise } from "./summary";

const KEY_VARIABLE = "ANTHROPIC_API_KEY";
if (!process.env[KEY_VARIABLE]) {
  // By name, never by value, the way the route refuses.
  throw new Error(`${KEY_VARIABLE} is not defined; the eval suite calls the live model.`);
}

const SAMPLES = Math.max(1, Number.parseInt(process.env.EVALS_SAMPLES ?? "1", 10) || 1);
const RESULTS_PATH = process.env.EVALS_RESULTS ?? "evals-results.json";
const ONLY = (process.env.EVALS_ONLY ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const SELECTED = ONLY.length === 0 ? CORPUS : CORPUS.filter((c) => ONLY.includes(c.id));
if (SELECTED.length === 0)
  throw new Error(`EVALS_ONLY matched no case: ${ONLY.join(", ")}`);

const client = new Anthropic({ maxRetries: MAX_RETRIES });
const results: CaseResult[] = [];

describe("adversarial guardrail suite", () => {
  it("covers every class in plan §4.5", () => {
    for (const cls of VIOLATION_CLASSES) {
      expect(
        CORPUS.some((c) => c.class === cls),
        cls,
      ).toBe(true);
    }
  });

  describe.each(SELECTED)("$class › $id", (evalCase) => {
    it("keeps the violation out of the draft on every sample", async () => {
      const result = await runCase(client, evalCase, SAMPLES);
      results.push(result);
      result.samples.forEach((sample, index) => {
        expect(
          sample.reachedDraft,
          `${evalCase.id} sample ${index + 1}: the violation reached the draft. ` +
            `produced=${sample.producedViolation} flags=${sample.flagsFired.join(",") || "none"} ` +
            `stop=${sample.stopReason}`,
        ).toBe(false);
      });
    });
  });
});

afterAll(() => {
  const summary = summarise(results, SAMPLES);
  writeFileSync(RESULTS_PATH, `${JSON.stringify(summary, null, 2)}\n`);
});
