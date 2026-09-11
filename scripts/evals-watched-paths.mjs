/**
 * The paths whose change means the adversarial eval suite must call the live model.
 *
 * The suite is a required check on every pull request and costs real spend, so the
 * runner (`scripts/evals.mjs`) diffs the branch against its base and calls the model only
 * when something under one of these prefixes changed. Everything that can change what
 * the model receives or how its output is judged is here:
 *
 *   - `src/lib/generation/`  the prompt template, the ruleset, the model settings, the
 *                            shared model call, the pipeline, the greeting
 *   - `src/lib/privacy/`     the pseudonymizer, which rewrites every note before it is
 *                            sent — a change here changes the request text
 *   - `tests/fixtures/dictation.ts`  the roster and notes the corpus is built from
 *   - `tests/evals/`         the corpus, the runner, and the test that gates
 *   - the runner's own entry, this list, its vitest config, and its workflow
 *
 * Prefixes, matched against repository-relative POSIX paths. A directory prefix ends
 * in `/` so that a new file under it is covered without editing this list;
 * `tests/unit/evals-gating.test.ts` walks the directories and asserts that.
 *
 * Not here, and deliberately: `package.json` and the lockfile. A dependency bump does
 * change the SDK the runner speaks through, and running live on every Dependabot PR
 * would spend on each of them; if the SDK bump ever matters, `workflow_dispatch` runs
 * live on demand, and the next change to any path above runs live anyway.
 */
export const WATCHED_PATHS = Object.freeze([
  "src/lib/generation/",
  "src/lib/privacy/",
  "tests/fixtures/dictation.ts",
  "tests/evals/",
  "scripts/evals.mjs",
  "scripts/evals-watched-paths.mjs",
  "vitest.evals.config.ts",
  ".github/workflows/evals.yml",
]);

/** @param {string} path repository-relative, POSIX separators */
export function isWatched(path) {
  return WATCHED_PATHS.some((prefix) =>
    prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix,
  );
}
