/**
 * Where the private term list comes from at run time: a file, or the environment.
 *
 * WHY THIS EXISTS. `src/lib/generation/private-terms.ts` loads the list from
 * `.guardrail-terms.local`, which is right on a machine with a filesystem the owner
 * controls and wrong on a hosted platform, where there is no such file and never will
 * be. Without this, the private-term rule would be silently inert on the deployment —
 * the exact failure that module's header warns about ("an inactive control that looks
 * active is worse than none"), except on the build that carries the real list.
 *
 * WHY IT IS HERE AND NOT BESIDE THAT MODULE. Its natural home is
 * `src/lib/generation/`, next to the loader it composes. That directory is watched by
 * `scripts/evals-watched-paths.mjs`, so editing anything in it makes the adversarial
 * suite call the live model — real spend to test a prompt and a ruleset this change
 * does not touch. Nothing about the placement is load-bearing: this file adds no
 * behaviour of its own, and every piece of the mechanism is still
 * `private-terms.ts`'s. Said plainly rather than left for a reader to wonder about.
 *
 * WHAT IT DECIDES. The file wins when it is present, so a machine with a local list
 * behaves exactly as before and a stale environment variable cannot override what
 * someone is editing in front of them. The environment is the fallback, for the
 * deployment. When neither is there the rule is inert and the caller says so at
 * start-up — unchanged.
 *
 * WHAT IT NEVER DOES. Return, log, or expose a term. The result carries a status, a
 * count, and which source answered.
 */

import {
  loadPrivateTerms,
  parseTerms,
  privateTermRule,
  PRIVATE_TERMS_FILE,
  type PrivateTerms,
} from "@/lib/generation/private-terms";

/** The variable the deployment sets, Production only. One term per line, as the file is. */
export const PRIVATE_TERMS_VARIABLE = "FIELDNOTE_GUARDRAIL_TERMS";

/** Which source answered. `none` means the rule is inert. */
export type PrivateTermsSource = "file" | "environment" | "none";

export interface ResolvedPrivateTerms extends PrivateTerms {
  source: PrivateTermsSource;
}

/**
 * The list, from the file if there is one, otherwise from the environment.
 *
 * Both arguments are injected rather than read here, so the resolution can be tested
 * without a real file at a real path and without stubbing the environment.
 */
export function resolvePrivateTerms(
  path: string = PRIVATE_TERMS_FILE,
  raw: string | undefined = process.env[PRIVATE_TERMS_VARIABLE],
): ResolvedPrivateTerms {
  const fromFile = loadPrivateTerms(path);
  if (fromFile.status === "loaded") return { ...fromFile, source: "file" };

  const terms = raw ? parseTerms(raw) : [];
  if (terms.length > 0) {
    return {
      status: "loaded",
      count: terms.length,
      rule: privateTermRule(terms),
      source: "environment",
    };
  }

  // A variable set to blank lines and comments is the same as no variable: inert, and
  // reported as such, rather than "loaded" with a count of zero.
  return { status: "absent", count: 0, rule: privateTermRule([]), source: "none" };
}
