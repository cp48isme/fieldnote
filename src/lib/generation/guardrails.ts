/**
 * The guardrail ruleset, versioned.
 *
 * CLAUDE.md: a change to a guardrail ruleset increments its version and is recorded in the
 * audit schema. `GUARDRAIL_RULESET_VERSION` is what `DraftRecord.guardrailRulesetVersion`
 * and `AuditRecord.guardrailRulesetVersion` will carry from session 6, and the rule ids
 * here are what `AuditRecord.flagsFired` will hold. Change a rule, change the version, add
 * a line to the notes below.
 *
 * WHAT A GUARDRAIL IS HERE. The prompt tells the model what not to write; this module is
 * what happens when it writes it anyway. Each rule looks at one sentence of the draft, in
 * its pseudonymized form, and says whether that sentence may reach the representative.
 * A sentence that may not is replaced by the gap marker, so the block is visible in the
 * draft rather than silent — plan §4.2 says blocked, not flagged, and a sentence that
 * vanished without trace is the flag nobody sees. Every rule has an adversarial case in
 * `tests/unit/guardrails.test.ts` that fails when the rule is removed.
 *
 * VERSION NOTES
 *
 *   1.0.0 — 2026-09-09, session 5. First ruleset. Six rules, listed below.
 *
 *           Comparisons and performance words are blocked even when attributed to the
 *           recipient — "you said it is faster than yours" — because a relayed comparison
 *           in the sender's email reads as the sender's endorsement. Other product
 *           language attributed to the recipient passes as relational text.
 *
 *           Claim-bearing text is blocked, all of it, because the approved content library
 *           does not exist until session 9 and everything claim-bearing is therefore
 *           unmatched. The classifier is a heuristic: a sentence is claim-bearing when it
 *           describes the product in the sender's voice — a product noun with a
 *           characteristic or performance word, or a comparison — and is not attributed to
 *           the recipient. It will misclassify in both directions; when it does, the
 *           direction that matters is the one that lets a claim through, and the review
 *           gate reads every draft. Session 9's matcher replaces the heuristic with a
 *           lookup against the library.
 *
 *           `fieldnote-dx0`, decided here: clinical and domain vocabulary in relational
 *           text passes. A sentence that attributes a term to the recipient — "you
 *           mentioned the economics of the room" — is Class 1 under plan §4.2 by
 *           definition, and this ruleset does not touch it, so a term dictation mangled
 *           reaches the draft as the recipient's own word. The same term in the sender's
 *           voice beside a product noun is claim-bearing and is blocked. That is the
 *           classifier's caution as a side effect, exactly as the bead predicted, and not
 *           a control on the input; the control on the input is the representative's read
 *           at review, and the bead stays open for session 15's threat model.
 */

import {
  ABBREVIATED_TITLES,
  titleFollowedByToken,
  titleQualifies,
} from "@/lib/privacy/titles";

import { GAP_MARKER } from "./prompt";

export const GUARDRAIL_RULESET_VERSION = "1.0.0";

export interface GuardrailRule {
  /** Stable id, recorded in `flagsFired`. */
  readonly id: string;
  readonly description: string;
  /** Whether this sentence must not reach the representative. */
  violates(sentence: string): boolean;
}

// --- The claim-bearing classifier -----------------------------------------------------

/** A noun that names the product or something of it. */
const PRODUCT_NOUN =
  /\b(?:system|systems|device|devices|platform|product|technology|console|consoles|instruments?|instrumentation|tool|tooling|equipment|robotic|robotics|kit|module|solution|unit)\b/i;

/** A word that describes a characteristic, capability, or performance. */
const DESCRIPTOR =
  /\b(?:faster|quicker|better|safer|easier|superior|improv\w*|reduc\w*|increas\w*|enhanc\w*|precis\w*|accura\w*|efficien\w*|ergonomic\w*|modular|compatible|capab\w*|design\w*|allow\w*|enabl\w*|deliver\w*|provid\w*|offer\w*|support\w*|outcome\w*|clinical\w*|proven|effective\w*|reliab\w*|seamless\w*|flexib\w*|versatil\w*|minimal\w*|smaller|larger|lighter|fits?|footprint|features?|advantage\w*|benefit\w*|performance|performs?)\b/i;

/**
 * A word that makes a claim on its own, attribution or not. A comparison in a sentence
 * that also says "you mentioned" is still the sender comparing, and a relayed comparison
 * in the sender's email reads as the sender's endorsement. Indications, regulatory status,
 * and figures belong to their own rules below and are not repeated here, so that each
 * rule's adversarial case fails when that rule alone is removed.
 */
const STRONG_CLAIM =
  /\bthan\b|\b(?:faster|quicker|better|safer|superior|proven|outcomes?|reduces?|reducing|improv\w*|efficacy|effective\w*)\b/i;

/** The sentence reports what the recipient said, asked, or felt. */
const ATTRIBUTED =
  /\b(?:you|your)\b[^.!?]*\b(?:mention\w*|said|asked|rais\w*|not(?:ed|iced)|flag\w*|describ\w*|told|question\w*|concern\w*|feedback|thoughts?|interest\w*|comment\w*|observ\w*|point\w*|wonder\w*|felt|found|liked?|appreciat\w*|reaction|impression|curious|keen|view)\b|\b(?:mention\w*|said|asked|rais\w*|not(?:ed|iced)|flag\w*|describ\w*|told|question\w*|concern\w*|feedback|thoughts?|interest\w*|comment\w*|observ\w*|point\w*|wonder\w*|felt|found|liked?|appreciat\w*|reaction|impression|curious|keen|view)\b[^.!?]*\b(?:you|your)\b/i;

/**
 * Plan §4.2, mechanised. Relational text — including what the recipient said about the
 * product, attributed to them — passes. Product language in the sender's voice does not.
 */
export function isClaimBearing(sentence: string): boolean {
  if (STRONG_CLAIM.test(sentence)) return true;
  return (
    PRODUCT_NOUN.test(sentence) && DESCRIPTOR.test(sentence) && !ATTRIBUTED.test(sentence)
  );
}

// --- The rules ------------------------------------------------------------------------

const claimBearing: GuardrailRule = {
  id: "claim-bearing",
  description:
    "Product characteristics, capabilities, performance, or comparisons in the sender's voice. Selected from the library or not written; there is no library yet, so not written.",
  violates: isClaimBearing,
};

const indication: GuardrailRule = {
  id: "indication",
  description:
    "Indications, regulatory status, or off-label use. Claim-bearing by definition.",
  violates: (s) =>
    /\b(?:indicat(?:ed|ion|ions)|off-label|on-label|approved for|cleared for|FDA|CE[- ]mark\w*|regulatory|contraindicat\w*)\b/i.test(
      s,
    ),
};

const pricing: GuardrailRule = {
  id: "pricing",
  description:
    "Prices, discounts, cost comparisons, or figures. Commercial terms are not follow-up material.",
  violates: (s) =>
    /[$£€]\s?\d|\d\s?(?:%|percent)|\b(?:discount\w*|cheaper|savings?|reduction|cost of ownership|price list|pricing|per unit|quote[ds]?|consignment)\b/i.test(
      s,
    ),
};

const hospitality: GuardrailRule = {
  id: "hospitality",
  description:
    "Offers of meals, travel, gifts, or payment. Anything of value offered to a healthcare professional is a compliance matter, not a courtesy.",
  violates: (s) =>
    /\b(?:dinner|lunch|breakfast|meal|meals|drinks?|flights?|airfare|hotel|accommodation|honorari(?:um|a)|gifts?|vouchers?|tickets?|expenses|reimburse\w*|on (?:me|us)\b)\b/i.test(
      s,
    ),
};

const patient: GuardrailRule = {
  id: "patient",
  description:
    "Any mention of a patient. A follow-up about a demonstration has no reason to.",
  violates: (s) => /\bpatients?\b|\byear-old\b|\bcase of a\b/i.test(s),
};

const inventedName: GuardrailRule = {
  id: "invented-name",
  description:
    "A name-shaped string after a title. The model cannot know a name, so any it writes is invented or echoed, and neither belongs in a draft.",
  violates: (s) => {
    for (const match of s.matchAll(titleFollowedByToken())) {
      const [, title, following] = match;
      if (titleQualifies(title) && !following.startsWith("[")) return true;
    }
    return false;
  },
};

/** The ruleset, in the order flags are reported. */
export const RULESET: readonly GuardrailRule[] = [
  claimBearing,
  indication,
  pricing,
  hospitality,
  patient,
  inventedName,
];

// --- Application ----------------------------------------------------------------------

export interface GuardrailResult {
  /** The draft with every violating sentence replaced by the gap marker. */
  text: string;
  /** Ids of rules that fired, deduplicated, in ruleset order. */
  flagsFired: string[];
  /** How many sentences were replaced. */
  blockedSentences: number;
}

/**
 * Splits a line into sentences on terminal punctuation. Coarse on purpose: a split that
 * errs toward larger pieces blocks more text when a rule fires, which is the safe
 * direction. The one refinement is that a period after an abbreviated title is not the
 * end of a sentence — otherwise "Dr. Marlow agreed." splits before the name and the
 * invented-name rule never sees title and name together.
 */
const SENTENCE_BOUNDARY = new RegExp(
  `(?<=[.!?])(?<!\\b(?:${ABBREVIATED_TITLES.join("|")})\\.)\\s+`,
  "i",
);

function sentencesOf(line: string): string[] {
  return line.split(SENTENCE_BOUNDARY).filter((s) => s.length > 0);
}

export function applyGuardrails(
  draft: string,
  ruleset: readonly GuardrailRule[] = RULESET,
): GuardrailResult {
  const fired = new Set<string>();
  let blockedSentences = 0;

  const text = draft
    .split("\n")
    .map((line) =>
      sentencesOf(line)
        .map((sentence) => {
          if (sentence === GAP_MARKER) return sentence;
          const violated = ruleset.filter((rule) => rule.violates(sentence));
          if (violated.length === 0) return sentence;
          for (const rule of violated) fired.add(rule.id);
          blockedSentences += 1;
          return GAP_MARKER;
        })
        .join(" "),
    )
    .join("\n");

  return {
    text,
    flagsFired: ruleset.map((r) => r.id).filter((id) => fired.has(id)),
    blockedSentences,
  };
}
