/**
 * The pseudonymization boundary.
 *
 * The session's done-when is that a test asserts no raw name can reach the API client and
 * fails if the guard is removed. Both halves are here, and the second is demonstrated
 * rather than asserted: `the guard is not decorative` rebuilds the exact conditions with
 * the structural pass disabled and shows the guard catching what a roster-only tokenizer
 * lets through.
 *
 * Fixtures and their provenance live in `tests/fixtures/dictation.ts`.
 */

import { describe, expect, it } from "vitest";

import {
  assertPseudonymized,
  createPseudonymizer,
  PseudonymizationError,
} from "@/lib/privacy/pseudonymize";
import {
  ADAPTED_NOTES,
  ALL_CASES,
  CONSTRUCTED_CASES,
  OBSERVED_CASES,
  OBSERVED_MANGLING,
  ROSTER,
} from "../fixtures/dictation";

const caseById = (id: string) => {
  const found = ALL_CASES.find((c) => c.id === id);
  if (!found) throw new Error(`no fixture ${id}`);
  return found.text;
};

describe("roster matching", () => {
  it("tokenizes a full name, a surname, and a possessive", () => {
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("constructed-possessive"));

    expect(out).not.toMatch(/Okonjo-Baptiste/i);
    expect(out).toMatch(/\[HCP_\d+\]'s registrar/);
    // The possessive is preserved outside the token, so rehydration restores the prose.
    expect(p.rehydrate(out)).toBe(caseById("constructed-possessive"));
  });

  it("gives a surname shared by two attendees one token, and round-trips it", () => {
    const p = createPseudonymizer(ROSTER);
    const source = caseById("constructed-shared-surname");
    const out = p.pseudonymize(source);

    expect(out).not.toMatch(/Vance/i);
    // One token for the written text, because which Vance was meant is not knowable and
    // guessing would rehydrate the wrong name into a draft.
    const tokens = new Set(out.match(/\[\w+_\d+\]/g));
    expect(tokens.size).toBe(1);
    expect(p.rehydrate(out)).toBe(source);
  });

  it("is stable: the same name gets the same token throughout", () => {
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(
      "Okonjo-Baptiste opened the session. Later Okonjo-Baptiste asked about the port.",
    );
    const tokens = out.match(/\[\w+_\d+\]/g) ?? [];
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toBe(tokens[1]);
  });

  it("classifies a clinician and a coordinator differently", () => {
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize("Okonjo-Baptiste and Piper both attended.");
    expect(out).toMatch(/\[HCP_\d+\]/);
    expect(out).toMatch(/\[STAFF_\d+\]/);
  });
});

describe("the structural rule", () => {
  it("tokenizes a mangled name the roster has never seen", () => {
    // The case the rule exists for. `Swelha` matches no roster entry and no fuzzy matcher
    // that stays off ordinary prose would reach it from `Swali`. The title is the signal.
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("observed-1"));

    expect(out).not.toContain(OBSERVED_MANGLING.transcribed);
    expect(out).toMatch(/Dr\. \[PERSON_\d+\]/);
    expect(p.rehydrate(out)).toBe(caseById("observed-1"));
  });

  it("catches a transposed-letter near-miss and an unpronounceable fragment", () => {
    for (const id of ["constructed-transposed", "constructed-fragment"]) {
      const p = createPseudonymizer(ROSTER);
      const out = p.pseudonymize(caseById(id));
      expect(out, id).toMatch(/\[PERSON_\d+\]/);
    }
  });

  it("catches a lowercase title, which is how dictation writes them", () => {
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("constructed-lowercase-title"));
    expect(out).not.toMatch(/\bswali\b/i);
    expect(out).toMatch(/dr \[PERSON_\d+\]/);
  });

  it("tokenizes a bare initial after a title", () => {
    const p = createPseudonymizer(ROSTER);
    expect(p.pseudonymize(caseById("adapted-1"))).toMatch(/Dr \[PERSON_\d+\] spent/);
    expect(p.pseudonymize(caseById("adapted-5"))).toMatch(/Dr\. \[PERSON_\d+\] was/);
  });

  it("leaves 'the doctor said' alone", () => {
    // `Doctor` is an ordinary noun, so it only counts as a title when capitalised.
    // Without that rule this fires on every note in the corpus.
    const p = createPseudonymizer(ROSTER);
    const source = caseById("constructed-title-as-noun");
    expect(p.pseudonymize(source)).toBe(source);
  });
});

describe("surnames that are also ordinary words", () => {
  it("tokenizes Dr. Green and Piper", () => {
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("constructed-common-noun-name"));
    expect(out).not.toMatch(/\bGreen\b/);
    expect(out).not.toMatch(/\bPiper\b/);
  });

  it("leaves the green light, Rome, and an orange cable alone", () => {
    // The other direction, and the one a careless implementation fails. Case-insensitive
    // roster matching tokenizes `green` here, which would put a token in the middle of a
    // sentence about a console light.
    const p = createPseudonymizer(ROSTER);
    const source = caseById("constructed-common-noun-not-name");
    expect(p.pseudonymize(source)).toBe(source);
  });
});

describe("the adapted corpus", () => {
  it("passes the guard after tokenization, every case", () => {
    for (const item of ALL_CASES) {
      const p = createPseudonymizer(ROSTER);
      const out = p.pseudonymize(item.text);
      expect(() => assertPseudonymized(out, ROSTER), item.id).not.toThrow();
    }
  });

  it("round-trips every case exactly", () => {
    for (const item of ALL_CASES) {
      const p = createPseudonymizer(ROSTER);
      expect(p.rehydrate(p.pseudonymize(item.text)), item.id).toBe(item.text);
    }
  });

  it("never throws on any input, however mangled", () => {
    // Fail-closed means tokenizing more, not refusing to draft. Nothing here reaches the
    // representative as an error.
    for (const item of ALL_CASES) {
      const p = createPseudonymizer(ROSTER);
      expect(() => p.pseudonymize(item.text), item.id).not.toThrow();
    }
  });

  it("leaves role references untokenized, which is a known gap", () => {
    // Recorded rather than hidden: `fieldnote-q0h`. In a single-institution note a role
    // identifies a person as surely as a surname, and neither pass sees one.
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("adapted-6"));
    expect(out).toContain("The chief executive");
  });

  it("preserves the dictation artifacts, which is why the fixtures exist", () => {
    const p = createPseudonymizer(ROSTER);
    expect(p.pseudonymize(caseById("adapted-2"))).toContain("number of chords");
    expect(p.pseudonymize(caseById("adapted-7"))).toContain("having residence trained");
    expect(p.pseudonymize(caseById("adapted-4"))).toContain("signal multi plier");
  });

  it("covers every adapted source note", () => {
    // Guards against a fixture being dropped and the suite silently shrinking.
    expect(ADAPTED_NOTES).toHaveLength(7);
    expect(OBSERVED_CASES.length).toBeGreaterThan(0);
    expect(CONSTRUCTED_CASES.length).toBeGreaterThan(0);
  });
});

describe("the guard", () => {
  it("accepts text with no names in it", () => {
    expect(() =>
      assertPseudonymized("The [HCP_1] asked about mounting time.", ROSTER),
    ).not.toThrow();
  });

  it("throws when a roster name survives", () => {
    expect(() => assertPseudonymized("Okonjo-Baptiste asked again.", ROSTER)).toThrow(
      PseudonymizationError,
    );
  });

  it("throws when an unknown name survives after a title", () => {
    expect(() =>
      assertPseudonymized(`Spoke with Dr. ${OBSERVED_MANGLING.transcribed}.`, ROSTER),
    ).toThrow(PseudonymizationError);
  });

  it("never puts the name it caught into the error message", () => {
    // The message reaches logs and terminals. Echoing the name would put it exactly where
    // this module exists to keep it out of.
    try {
      assertPseudonymized("Okonjo-Baptiste asked again.", ROSTER);
      expect.unreachable("guard should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain("Okonjo-Baptiste");
      expect(message).toContain("chars");
    }
  });

  it("is not decorative: a roster-only tokenizer fails it", () => {
    // The counterfactual, demonstrated rather than claimed. This is what the tokenizer
    // would produce with the structural pass removed — roster matching alone, which cannot
    // see a name it has never been told about.
    const rosterOnly = (text: string): string => {
      let out = text;
      for (const attendee of ROSTER) {
        out = out.replace(
          new RegExp(`\\b${attendee.displayName.split(/\s+/).pop()}\\b`, "g"),
          "[HCP_1]",
        );
      }
      return out;
    };

    const source = caseById("observed-1");
    const weakened = rosterOnly(source);

    // It looks like it worked — the text changed nothing, because nothing matched.
    expect(weakened).toContain(OBSERVED_MANGLING.transcribed);
    expect(() => assertPseudonymized(weakened, ROSTER)).toThrow(PseudonymizationError);

    // And the real tokenizer passes the same guard on the same input.
    const p = createPseudonymizer(ROSTER);
    expect(() => assertPseudonymized(p.pseudonymize(source), ROSTER)).not.toThrow();
  });
});
