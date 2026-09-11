#!/usr/bin/env node
/**
 * The adversarial guardrail suite's entry. `pnpm evals`. PROJECT-PLAN §4.5.
 *
 * A required check on every pull request that costs real spend, so the first thing it
 * does is decide whether a model call is warranted at all:
 *
 *   - `workflow_dispatch`, or `EVALS_RUN=live`, always runs live.
 *   - Otherwise the branch is diffed against its base (`GITHUB_BASE_REF` on a pull
 *     request, `main` locally). If nothing under the watched paths changed — the prompt,
 *     the ruleset, the model settings, the pseudonymizer, the corpus, the runner — the
 *     suite says so, names what it checked, and exits 0 without a single API call.
 *   - On `main` itself, or when no merge base can be found, it runs live rather than
 *     skipping on a guess.
 *
 * The watched paths are `evals-watched-paths.mjs`; `tests/unit/evals-gating.test.ts`
 * asserts they cover every file that can change what the model receives.
 *
 * A live run needs `ANTHROPIC_API_KEY`, checked by name and never printed, and spawns
 * vitest under `vitest.evals.config.ts`. The suite's exit code is this script's: a
 * violation that reached a draft fails the build, with no `continue-on-error` anywhere.
 * Afterwards the summary the suite wrote is printed — per class, overall, and what the
 * run cost from the API's usage fields.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { WATCHED_PATHS, isWatched } from "./evals-watched-paths.mjs";

const KEY_VARIABLE = "ANTHROPIC_API_KEY";
const RESULTS_PATH = process.env.EVALS_RESULTS ?? "evals-results.json";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/** @returns {{ live: boolean, why: string }} */
function decide() {
  if (process.env.EVALS_RUN === "live") return { live: true, why: "EVALS_RUN=live" };
  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    return { live: true, why: "workflow_dispatch always runs live" };
  }

  const base = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : git(["branch", "--show-current"]) === "main"
      ? null
      : "main";
  if (base === null) return { live: true, why: "on main, with no base to diff against" };

  let mergeBase;
  try {
    mergeBase = git(["merge-base", base, "HEAD"]);
  } catch {
    return {
      live: true,
      why: `no merge base with ${base} (shallow checkout?); running live rather than skipping on a guess`,
    };
  }

  // Working tree against the merge base, so uncommitted local changes count too.
  const changed = git(["diff", "--name-only", mergeBase]).split("\n").filter(Boolean);
  const watched = changed.filter(isWatched);
  const where = `${base} at ${mergeBase.slice(0, 7)}`;
  if (watched.length === 0) {
    return {
      live: false,
      why: `the diff against ${where} touches ${changed.length} file(s), none under the watched paths`,
    };
  }
  return {
    live: true,
    why: `the diff against ${where} touches ${watched.length} watched file(s): ${watched.join(", ")}`,
  };
}

function printSummary(summary) {
  const pct = (n, d) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(0)}%`);
  console.log("");
  console.log(
    `evals: ${summary.cases} cases, ${summary.samples} samples (${summary.samplesPerCase} per case), ` +
      `${summary.model}, prompt ${summary.promptTemplateVersion}, ruleset ${summary.guardrailRulesetVersion}, ${summary.ranAt}`,
  );
  console.log("");
  console.log("class               cases  samples  produced  caught  reached  blocked");
  for (const c of summary.classes) {
    console.log(
      `${c.class.padEnd(19)} ${String(c.cases).padStart(5)}  ${String(c.samples).padStart(7)}  ` +
        `${String(c.produced).padStart(8)}  ${String(c.caught).padStart(6)}  ${String(c.reached).padStart(7)}  ${String(c.blocked).padStart(7)}`,
    );
  }
  console.log("");
  console.log(
    `prompt-level: the model produced the violation on ${summary.produced} of ${summary.samples} samples (${pct(summary.produced, summary.samples)}). ` +
      `Not a gate; published per class.`,
  );
  console.log(
    `combined: the violation reached the draft on ${summary.reached} of ${summary.samples} samples ` +
      `(${pct(summary.samples - summary.reached, summary.samples)} kept out). The gate is 100%.`,
  );
  const u = summary.usage;
  console.log(
    `cost: ${u.inputTokens} input + ${u.outputTokens} output tokens` +
      (u.cacheReadTokens || u.cacheWriteTokens
        ? ` (+${u.cacheReadTokens} cache read, ${u.cacheWriteTokens} cache write)`
        : "") +
      ` = $${summary.costUsd.toFixed(4)} at ${summary.pricing.model} rates as of ${summary.pricing.ratesAsOf}.`,
  );
  console.log(`results: ${RESULTS_PATH}`);
}

const decision = decide();
if (!decision.live) {
  console.log(
    `evals: skipped — no model call made. ${decision.why}. ` +
      `Watched: ${WATCHED_PATHS.join(", ")}. ` +
      `A green check here on this change proves the gate was not needed, not that it holds.`,
  );
  process.exit(0);
}

console.log(`evals: running live — ${decision.why}.`);
if (!process.env[KEY_VARIABLE]) {
  console.error(
    `evals: ${KEY_VARIABLE} is not defined; the suite calls the live model and cannot run.`,
  );
  process.exit(1);
}

const run = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "--config", "vitest.evals.config.ts"],
  { stdio: "inherit", env: { ...process.env, EVALS_RESULTS: RESULTS_PATH } },
);

if (existsSync(RESULTS_PATH)) {
  printSummary(JSON.parse(readFileSync(RESULTS_PATH, "utf8")));
} else {
  console.error("evals: the suite wrote no results file.");
}

process.exit(run.status ?? 1);
