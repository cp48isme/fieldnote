/**
 * The private-term loader and rule, against a synthetic file.
 *
 * This proves the mechanism: the file format, the matching, the inert state when the file
 * is absent, and that the rule blocks a sentence carrying a listed term. It proves nothing
 * about the real list, which is not in the repository by construction — see the header of
 * `src/lib/generation/private-terms.ts`. Every term below is invented.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyGuardrails, RULESET } from "@/lib/generation/guardrails";
import {
  loadPrivateTerms,
  parseTerms,
  PRIVATE_TERM_RULE_ID,
  privateTermRule,
} from "@/lib/generation/private-terms";
import { GAP_MARKER } from "@/lib/generation/prompt";

const SYNTHETIC = ["# a comment", "", "Lantern", "Lantern Pro", "  Wickfield  "].join(
  "\n",
);

describe("the file format", () => {
  it("ignores comments and blank lines and trims terms", () => {
    expect(parseTerms(SYNTHETIC)).toEqual(["Lantern", "Lantern Pro", "Wickfield"]);
  });
});

describe("the rule", () => {
  const rule = privateTermRule(parseTerms(SYNTHETIC));

  it("blocks a sentence carrying a listed term, in any case, with a possessive", () => {
    for (const sentence of [
      "The lantern was well received.",
      "Your Lantern's setup time was the main concern.",
      "We can bring the Lantern Pro next time.",
    ]) {
      expect(rule.violates(sentence), sentence).toBe(true);
    }
  });

  it("does not fire on a longer word containing a term", () => {
    expect(rule.violates("The lanterns were on the table.")).toBe(false);
  });

  it("replaces the sentence with the gap marker and reports the flag", () => {
    const result = applyGuardrails(
      "Thank you for your time. The lantern was well received.",
      [...RULESET, rule],
    );
    expect(result.text).toBe(`Thank you for your time. ${GAP_MARKER}`);
    expect(result.flagsFired).toEqual([PRIVATE_TERM_RULE_ID]);
  });

  it("is not decorative: without the rule the sentence passes the public ruleset", () => {
    // The counterfactual, and the point: the public ruleset knows nothing about the term.
    const sentence = "The lantern was well received.";
    expect(applyGuardrails(sentence).text).toBe(sentence);
  });

  it("never fires with an empty list", () => {
    expect(privateTermRule([]).violates("The lantern was well received.")).toBe(false);
  });
});

describe("loading", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fieldnote-terms-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports absent and is inert when there is no file", () => {
    const loaded = loadPrivateTerms(join(dir, "missing"));
    expect(loaded.status).toBe("absent");
    expect(loaded.count).toBe(0);
    expect(loaded.rule.violates("The lantern was well received.")).toBe(false);
  });

  it("loads a file and reports a count, never the terms", () => {
    const path = join(dir, ".guardrail-terms.local");
    writeFileSync(path, SYNTHETIC);
    const loaded = loadPrivateTerms(path);
    expect(loaded.status).toBe("loaded");
    expect(loaded.count).toBe(3);
    expect(Object.keys(loaded)).toEqual(["status", "count", "rule"]);
    expect(loaded.rule.violates("We can bring the Lantern Pro next time.")).toBe(true);
  });
});
