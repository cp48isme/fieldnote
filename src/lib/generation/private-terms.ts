/**
 * Site- and product-specific terms the model must never write, loaded at runtime.
 *
 * The public ruleset in `guardrails.ts` carries generic terms only. It cannot carry the
 * private fork's product names, device categories, or site vocabulary, because this is a
 * public repository and ADR-0001 says no branding reaches it — and the pre-commit denylist
 * enforces that against exactly this file's kind of list. The first ruleset lost two
 * ordinary English words to that collision. The owner's decision: nothing from the private
 * denylist reaches the public repository, and the structure has to make that true rather
 * than a one-time removal.
 *
 * SO THE TERMS ARE NOT COMMITTED. They load from `.guardrail-terms.local`, gitignored, in
 * the shape `scripts/check-denylist.mjs` already uses for `.denylist.local`: one term per
 * line, blank lines and `#` comments ignored, case-insensitive, word-boundary aware. The
 * committed template is `.guardrail-terms.local.example`. The reasoning is that script's:
 * a committed list of the terms would publish what the list exists to keep out, and
 * hashing them is not a fix, because product names fall to a dictionary attack.
 *
 * WHERE IT RUNS. On the server, in the route, before the model's text is returned. The
 * ruleset in `guardrails.ts` runs in the browser and cannot read a file; the route can,
 * and it applies this rule to the model's output and reports the flag in the response so
 * the audit record (session 6) sees it beside the client's own flags. The route stays a
 * stateless pass-through — a term list read once at start-up is configuration, not state.
 *
 * THE LOADED TERMS ARE UNTESTABLE IN PUBLIC, BY CONSTRUCTION. `tests/unit/private-terms.test.ts`
 * exercises the loader and the rule against a synthetic file, which proves the mechanism
 * and nothing about the real list. Whether the private fork's list is complete, current,
 * or well-formed is verified only in the private fork, by whoever maintains the file. When
 * the file is absent — every public clone, every CI runner — the rule is inert and the
 * route logs that once at start-up, so an inactive control is visible rather than assumed.
 */

import { existsSync, readFileSync } from "node:fs";

import type { GuardrailRule } from "./guardrails";

export const PRIVATE_TERMS_FILE = ".guardrail-terms.local";

import { PRIVATE_TERM_RULE_ID } from "./contract";

/** The rule id, as it appears in `flagsFired`. Defined in `contract.ts`; see there for why. */
export { PRIVATE_TERM_RULE_ID };

export interface PrivateTerms {
  /** `absent` means the rule is inert; the route says so at start-up. */
  status: "loaded" | "absent";
  /** How many terms loaded. Never the terms. */
  count: number;
  rule: GuardrailRule;
}

function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One term to one pattern, exactly as the denylist script builds them. */
export function termPattern(term: string): RegExp {
  const lead = /^\w/.test(term) ? "\\b" : "";
  const tail = /\w$/.test(term) ? "\\b" : "";
  return new RegExp(lead + escape(term) + tail, "i");
}

/** Parses the file format: one term per line, blank lines and `#` comments ignored. */
export function parseTerms(contents: string): string[] {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/** The rule over a set of terms. An empty set never fires. */
export function privateTermRule(terms: readonly string[]): GuardrailRule {
  const patterns = terms.map(termPattern);
  return {
    id: PRIVATE_TERM_RULE_ID,
    description:
      "A site- or product-specific term from the private list, which the model must never write. The list is not in the repository.",
    violates: (sentence) => patterns.some((pattern) => pattern.test(sentence)),
  };
}

export function loadPrivateTerms(path: string = PRIVATE_TERMS_FILE): PrivateTerms {
  if (!existsSync(path)) {
    return { status: "absent", count: 0, rule: privateTermRule([]) };
  }
  const terms = parseTerms(readFileSync(path, "utf8"));
  return { status: "loaded", count: terms.length, rule: privateTermRule(terms) };
}
