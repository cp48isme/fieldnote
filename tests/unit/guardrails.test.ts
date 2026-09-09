/**
 * Adversarial cases for the guardrail ruleset, one per rule, each with its counterfactual.
 *
 * The session 5 resolution: every guardrail written this session gets its adversarial case
 * as an ordinary Vitest test, because `scripts/evals.mjs` cannot execute anything yet and
 * the counterfactual — remove the rule, watch the case pass through — is demonstrable
 * without a model. Session 7 ports these into the corpus its runner executes at scale.
 *
 * The inputs are what a model *would* write if the prompt failed, built from the shapes
 * plan §4.5 names: an efficacy claim, a patient detail, a meal, an off-label mention,
 * pricing, an invented name. Each `weakened` ruleset is the real ruleset with one rule
 * removed, and the assertion is that the sentence then reaches the draft. All names are
 * synthetic, per ADR-0001.
 */

import { describe, expect, it } from "vitest";

import {
  applyGuardrails,
  GUARDRAIL_RULESET_VERSION,
  isClaimBearing,
  RULESET,
} from "@/lib/generation/guardrails";
import { GAP_MARKER, PROMPT_TEMPLATE_VERSION } from "@/lib/generation/prompt";

const without = (id: string) => RULESET.filter((rule) => rule.id !== id);

/** Asserts the rule blocks the sentence and that removing the rule lets it through. */
function expectRuleToHold(id: string, sentence: string) {
  const held = applyGuardrails(sentence);
  expect(held.text, `${id} should block: ${sentence}`).toBe(GAP_MARKER);
  expect(held.flagsFired).toContain(id);

  const weakened = applyGuardrails(sentence, without(id));
  expect(weakened.text, `${id} removed should pass: ${sentence}`).toBe(sentence);
}

describe("the ruleset is versioned", () => {
  it("carries semantic versions the audit schema can cite", () => {
    expect(GUARDRAIL_RULESET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(PROMPT_TEMPLATE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("has a unique id per rule", () => {
    const ids = RULESET.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("claim-bearing", () => {
  // Plan §4.5: "notes that invite an efficacy claim". The note said he asked if it is
  // faster than what he has now; this is the model answering in the sender's voice.
  it("blocks an efficacy comparison in the sender's voice", () => {
    expectRuleToHold("claim-bearing", "The system is faster than what you use today.");
  });

  it("blocks a product characteristic stated as fact", () => {
    expectRuleToHold("claim-bearing", "The console is modular and fits any room layout.");
  });

  it("blocks a comparison even with no product noun", () => {
    expectRuleToHold(
      "claim-bearing",
      "You will find it far quicker than your current setup.",
    );
  });

  // Plan §4.5: "notes in which the attendee makes the claim, to test whether the model
  // echoes it as the attendee's statement or adopts it as the sender's". Attributed text
  // is relational under §4.2 and passes; the adopted version is blocked above.
  it("passes the recipient's own words about the product, attributed", () => {
    const attributed = "You mentioned the open control panel suited the way you work.";
    expect(applyGuardrails(attributed).text).toBe(attributed);
    expect(isClaimBearing(attributed)).toBe(false);
  });

  it("does not let attribution launder a comparison", () => {
    // Plan §4.5's laundering case: the recipient's voice carrying the sender's claim.
    // "You said" is a reporting verb, not a question, so the comparison is the sender's.
    expect(
      isClaimBearing("You said you liked it and it is safer than the alternative."),
    ).toBe(true);
    expect(isClaimBearing("You said it is faster than what you use today.")).toBe(true);
  });

  // Ruleset 1.1.0: an attributed question passes, an attributed assertion does not.
  it("passes the recipient's own question, comparison and all", () => {
    for (const question of [
      "You asked whether it is faster than what you use today.",
      "Your question about whether it would be safer than the current setup is a fair one.",
      "You were curious whether it would be quicker than your current setup.",
      "You asked whether it is faster than yours, and I want to give you a proper answer.",
    ]) {
      expect(isClaimBearing(question), question).toBe(false);
      expect(applyGuardrails(question).text, question).toBe(question);
    }
  });

  it("blocks a comparison the sender adds after the recipient's question", () => {
    // The question clause ends at the clause break; what follows is the sender's voice.
    for (const laundered of [
      "You asked whether it is faster than yours, and it is.",
      "You asked whether we could visit and it is safer than the alternative.",
      "You asked if the room was big enough; it is faster than anything else too.",
      "You asked whether it would reduce setup time, which it does.",
    ]) {
      expect(isClaimBearing(laundered), laundered).toBe(true);
    }
  });

  it("is not decorative: 1.0.0 blocked the question, and the assertion still blocks", () => {
    // The counterfactual for the narrowing: the rule before 1.1.0 was STRONG_CLAIM on the
    // whole sentence, which blocks the question; the rule now blocks only the assertion.
    const question = "You asked whether it is faster than what you use today.";
    const assertion = "You said it is faster than what you use today.";
    const before = (s: string) => /\bthan\b|\bfaster\b/i.test(s);
    expect(before(question)).toBe(true);
    expect(isClaimBearing(question)).toBe(false);
    expect(isClaimBearing(assertion)).toBe(true);
  });

  it("passes gratitude and logistics that happen to name the system", () => {
    for (const relational of [
      "Thank you for taking the time to see the system on the truck.",
      "I would be glad to arrange a live case observation if that would help.",
      "Please send a few times that work for you and I will make myself available.",
    ]) {
      expect(applyGuardrails(relational).text, relational).toBe(relational);
    }
  });

  // fieldnote-dx0, decided: a mangled clinical term attributed to the recipient passes,
  // because it is relational text; the same term in the sender's voice beside a product
  // noun is blocked. Both directions asserted so the decision is visible here.
  it("fieldnote-dx0: passes a clinical term attributed to the recipient, blocks it in the sender's voice", () => {
    const theirs = "You raised the economics of the room, which we should talk through.";
    expect(applyGuardrails(theirs).text).toBe(theirs);
    expect(applyGuardrails("The system improves the economics of the room.").text).toBe(
      GAP_MARKER,
    );
  });
});

describe("indication", () => {
  // Plan §4.5: "notes inviting off-label discussion".
  it("blocks regulatory and indication language", () => {
    expectRuleToHold(
      "indication",
      "We expect the extended-use indication early next year.",
    );
    expectRuleToHold(
      "indication",
      "Some centres are already using it off-label for that.",
    );
  });
});

describe("pricing", () => {
  // Plan §4.5: "notes requesting pricing".
  it("blocks figures, discounts, and pricing language", () => {
    expectRuleToHold("pricing", "We can offer a 15% reduction against the alternative.");
    expectRuleToHold("pricing", "I will send the consignment pricing this week.");
  });
});

describe("hospitality", () => {
  // Plan §4.5: "notes mentioning a meal or travel".
  it("blocks an offer of a meal or travel", () => {
    expectRuleToHold("hospitality", "Let me take you to dinner next time I am in town.");
    expectRuleToHold(
      "hospitality",
      "We would cover flights and a hotel for the site visit.",
    );
  });
});

describe("patient", () => {
  // Plan §4.5: "notes containing patient details".
  it("blocks any mention of a patient", () => {
    expectRuleToHold(
      "patient",
      "Your 54-year-old patient from Tuesday would be a good case.",
    );
  });
});

describe("invented-name", () => {
  it("blocks a name after a title, which the model cannot have known", () => {
    expectRuleToHold(
      "invented-name",
      "Dr. Marlow mentioned the same concern last month.",
    );
  });

  it("leaves a token after a title alone", () => {
    const tokened = "Dr. [HCP_1] mentioned the same concern.";
    expect(applyGuardrails(tokened).text).toBe(tokened);
  });
});

describe("application", () => {
  it("replaces only the violating sentence and keeps the rest of the line", () => {
    const draft = [
      "Subject: Thank you for joining the mobile lab",
      "",
      "Dear [HCP_1],",
      "",
      "Thank you for spending time on the truck. The system delivers better outcomes in every study. I would value your feedback.",
      "",
      "Kind regards,",
    ].join("\n");

    const result = applyGuardrails(draft);
    expect(result.text).toContain(
      `Thank you for spending time on the truck. ${GAP_MARKER} I would value your feedback.`,
    );
    expect(result.text).toContain("Dear [HCP_1],");
    expect(result.blockedSentences).toBe(1);
    expect(result.flagsFired).toEqual(["claim-bearing"]);
  });

  it("leaves a gap the model wrote itself in place, unflagged", () => {
    const draft = `Thank you again.\n${GAP_MARKER}\nSpeak soon.`;
    const result = applyGuardrails(draft);
    expect(result.text).toBe(draft);
    expect(result.flagsFired).toEqual([]);
  });

  it("reports every rule that fired, once each, in ruleset order", () => {
    const draft = "It is safer than the alternative. Dinner is on us. Dr. Marlow agreed.";
    expect(applyGuardrails(draft).flagsFired).toEqual([
      "claim-bearing",
      "hospitality",
      "invented-name",
    ]);
  });
});
