/**
 * Branch protection on `main` is coupled to three strings.
 *
 * The required status checks are `Verify`, `Adversarial guardrail suite`, and
 * `Analyze (javascript-typescript)`: the *display names* of three jobs, not their ids
 * and not their workflows' names. GitHub matches a required context against the name a
 * job reports when it runs. Rename the job and the required check stops matching; GitHub
 * does not warn, the check never reports, and the merge button goes green with the gate
 * absent. The control is present, wired, and doing nothing. `fieldnote-awv` recorded it
 * as a live weakness on 2026-09-01, verified against the protection API, and
 * `docs/THREAT-MODEL.md` carries the entry.
 *
 * THIS TEST IS THE TRIPWIRE FOR A RENAME. It reads the workflow files and asserts that
 * the rendered job names are exactly the three required contexts — so a rename, a
 * removed job, a missing workflow file, or a new job fails `pnpm test` in `Verify`, on
 * the pull request that made the change, before it merges. A new job is a failure on
 * purpose: whether it should be required is a settings decision, and this file is where
 * that decision is written down on the code side.
 *
 * A TEMPLATE IS RESOLVED, NOT COMPARED LITERALLY. GitHub's own generated CodeQL workflow
 * names its job `Analyze (${{ matrix.language }})` and the check it reports is the
 * rendered form. Comparing the literal string would fail on a correct workflow written
 * that way, or pass while the rendered check changed. `tests/unit/support/workflow-jobs.ts`
 * expands a `${{ matrix.<key> }}` against the job's matrix and says why it does nothing
 * more.
 *
 * THE OTHER HALF OF THE COUPLING IS NOT CHECKED BY CODE. The list of required contexts
 * lives in GitHub's settings — on 2026-09-15 in the classic branch-protection rule for
 * `main`, with no repository ruleset — and nothing in this repository reads it. This
 * test holds the code side still; if the settings side changes, the strings below are
 * wrong and nothing here will say so. Verify with:
 *
 *   gh api repos/<owner>/<repo>/branches/main/protection/required_status_checks
 *
 * Counterfactual, run while writing this file: `name: Verify` in `ci.yml` changed to
 * `Verify2` in the working tree, this test failed naming the file, the required context,
 * and the name that rendered in its place; `.github/` was restored with
 * `git checkout -- .github/`, `git diff --stat .github/` was empty, and the test ran
 * green again before anything was committed. A rename that reaches a commit is the
 * weakness this file exists to catch.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderedJobNames } from "./support/workflow-jobs";

/** The required contexts on `main`, and the workflow file each is expected to come from. */
const REQUIRED_CONTEXTS: ReadonlyArray<{ file: string; context: string }> = [
  { file: ".github/workflows/ci.yml", context: "Verify" },
  { file: ".github/workflows/evals.yml", context: "Adversarial guardrail suite" },
  { file: ".github/workflows/codeql.yml", context: "Analyze (javascript-typescript)" },
];

const WORKFLOW_FILES = [...new Set(REQUIRED_CONTEXTS.map((entry) => entry.file))];

function readWorkflow(file: string): string {
  const path = join(process.cwd(), file);
  // Existence is asserted separately so the failure names the file rather than throwing
  // from the read.
  expect(existsSync(path), `${file} is missing`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("required status checks", () => {
  it("finds every workflow file the protection depends on, and a job in each", () => {
    for (const file of WORKFLOW_FILES) {
      const jobs = renderedJobNames(readWorkflow(file));
      // Guards against the parser silently finding nothing, which would make the
      // assertion below vacuous.
      expect(jobs.size, `${file} has no jobs`).toBeGreaterThan(0);
    }
  });

  it("renders exactly the three required contexts, each from its workflow", () => {
    const rendered = new Map<string, string[]>();
    for (const file of WORKFLOW_FILES) {
      rendered.set(file, [...renderedJobNames(readWorkflow(file)).values()].flat());
    }
    for (const { file, context } of REQUIRED_CONTEXTS) {
      expect(rendered.get(file), `${file} renders the required context`).toContain(
        context,
      );
    }
    const all = [...rendered.values()].flat().sort();
    const required = REQUIRED_CONTEXTS.map((entry) => entry.context).sort();
    expect(
      all,
      "every rendered job name is a required context, and nothing else",
    ).toEqual(required);
  });

  it("resolves a matrix template rather than comparing it literally", () => {
    const generated = [
      "jobs:",
      "  analyze:",
      "    name: Analyze (${{ matrix.language }})",
      "    strategy:",
      "      matrix:",
      "        language: [javascript-typescript, python]",
      "  build:",
      "    runs-on: ubuntu-latest",
    ].join("\n");
    expect(renderedJobNames(generated)).toEqual(
      new Map([
        ["analyze", ["Analyze (javascript-typescript)", "Analyze (python)"]],
        // No `name`: GitHub renders the id.
        ["build", ["build"]],
      ]),
    );
  });

  it("refuses to guess at a template it cannot resolve", () => {
    const noMatrix = [
      "jobs:",
      "  analyze:",
      "    name: Analyze (${{ matrix.language }})",
    ].join("\n");
    expect(() => renderedJobNames(noMatrix)).toThrow(/matrix\.language/);

    const notMatrix = ["jobs:", "  verify:", "    name: Verify ${{ github.ref }}"].join(
      "\n",
    );
    expect(() => renderedJobNames(notMatrix)).toThrow(/not a matrix reference/);

    const include = [
      "jobs:",
      "  analyze:",
      "    name: Analyze (${{ matrix.language }})",
      "    strategy:",
      "      matrix:",
      "        include:",
      "          - language: python",
    ].join("\n");
    expect(() => renderedJobNames(include)).toThrow(/include/);
  });
});
