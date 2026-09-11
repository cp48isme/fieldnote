/**
 * The run's summary: per class and overall, with the cost. Written by the eval test to
 * a JSON file the entry script prints, and the source for the figures in `README.md`.
 */

import { GUARDRAIL_RULESET_VERSION } from "@/lib/generation/guardrails";
import { PROMPT_TEMPLATE_VERSION } from "@/lib/generation/prompt";

import { CORPUS, VIOLATION_CLASSES, type ViolationClass } from "./corpus";
import { NO_USAGE, PRICING, addUsage, costUsd, type Usage } from "./pricing";
import type { CaseResult } from "./runner";

export interface ClassSummary {
  class: ViolationClass;
  cases: number;
  samples: number;
  /** Samples on which the model produced the violation. */
  produced: number;
  /** Of those, samples on which the ruleset caught it. Null-rule classes count none. */
  caught: number;
  /** Samples on which the violation reached the draft. The gate. */
  reached: number;
  /** Samples withheld by the pipeline (refusal, truncation). */
  blocked: number;
}

export interface RunSummary {
  ranAt: string;
  model: string;
  promptTemplateVersion: string;
  guardrailRulesetVersion: string;
  samplesPerCase: number;
  /** Cases in the corpus; `cases` is how many ran. Equal unless `EVALS_ONLY` was set. */
  corpusSize: number;
  cases: number;
  samples: number;
  classes: ClassSummary[];
  produced: number;
  reached: number;
  blocked: number;
  usage: Usage;
  costUsd: number;
  pricing: typeof PRICING;
  results: CaseResult[];
}

export function summarise(results: CaseResult[], samplesPerCase: number): RunSummary {
  const classes: ClassSummary[] = VIOLATION_CLASSES.map((cls) => {
    const inClass = results.filter((r) => r.class === cls);
    const samples = inClass.flatMap((r) => r.samples);
    return {
      class: cls,
      cases: inClass.length,
      samples: samples.length,
      produced: samples.filter((s) => s.producedViolation).length,
      caught: samples.filter((s) => s.rulesetCaught === true).length,
      reached: samples.filter((s) => s.reachedDraft).length,
      blocked: samples.filter((s) => s.blocked !== null).length,
    };
  });
  const all = results.flatMap((r) => r.samples);
  const usage = all.reduce((sum, s) => addUsage(sum, s.usage), NO_USAGE);
  return {
    ranAt: new Date().toISOString(),
    model: PRICING.model,
    promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
    guardrailRulesetVersion: GUARDRAIL_RULESET_VERSION,
    samplesPerCase,
    corpusSize: CORPUS.length,
    cases: results.length,
    samples: all.length,
    classes,
    produced: all.filter((s) => s.producedViolation).length,
    reached: all.filter((s) => s.reachedDraft).length,
    blocked: all.filter((s) => s.blocked !== null).length,
    usage,
    costUsd: costUsd(usage),
    pricing: PRICING,
    results,
  };
}
