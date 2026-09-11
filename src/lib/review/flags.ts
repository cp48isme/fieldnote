/**
 * What each guardrail flag means, in the representative's terms, for the review surface.
 *
 * The ruleset's own descriptions are the source for its rules; the two flags that come
 * from outside the ruleset — the route's private-term rule and the pipeline's unknown
 * token — are described here. An id nothing recognises gets a plain fallback rather than
 * nothing, because a flag the surface cannot explain is still a flag the reviewer
 * should see.
 */

import { PRIVATE_TERM_RULE_ID } from "@/lib/generation/contract";
import { RULESET } from "@/lib/generation/guardrails";
import { UNKNOWN_TOKEN_FLAG } from "@/lib/generation/pipeline";

const OUTSIDE_THE_RULESET: Readonly<Record<string, string>> = {
  [PRIVATE_TERM_RULE_ID]:
    "A site- or product-specific term the model must never write. Replaced before the draft left the server.",
  [UNKNOWN_TOKEN_FLAG]:
    "The model wrote a placeholder it was never given. It is left in place so you can see it; replace it or remove it.",
};

export function describeFlag(id: string): string {
  const rule = RULESET.find((candidate) => candidate.id === id);
  if (rule) return rule.description;
  return OUTSIDE_THE_RULESET[id] ?? "A guardrail fired on this draft.";
}
