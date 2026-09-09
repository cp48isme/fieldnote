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
    // `registrar` was left in place until ADR-0007. "Dr. Okonjo-Baptiste's registrar" is a
    // definite reference to one person, and the roster has a registrar, so it now shares
    // that attendee's token — the role pass at work, not a regression.
    expect(out).toMatch(/\[HCP_\d+\]'s \[HCP_\d+\]/);
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

  it("does not treat lowercase 'doctor' as a title", () => {
    // `Doctor` is an ordinary noun, so it only counts as a title when capitalised.
    // Without that rule this fires on every note in the corpus and tokenizes `said`.
    //
    // Until ADR-0007 this test asserted the sentence came through untouched. It no longer
    // does: "the doctor" is a definite role reference and the role pass tokenizes it,
    // deliberately. What the title rule must still guarantee is that the word *after* the
    // noun survives — the role pass replaces the reference, never the verb.
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("constructed-title-as-noun"));
    expect(out).toMatch(
      /^\[ROLE_1\] said the room was too small and \[ROLE_1\] recommended/,
    );
    expect(out).not.toMatch(/\[PERSON_/);
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

  it("tokenizes role references, which was a known gap until ADR-0007", () => {
    // This test asserted the opposite from session 4 to session 5, recording
    // `fieldnote-q0h` as a gap rather than hiding it. The gap is now closed: in a
    // single-institution note a role identifies a person as surely as a surname, so a
    // role the roster does not know gets its own token, and the plural "the surgeons",
    // which refers to nobody, is left alone. Both directions are asserted on purpose.
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("adapted-6"));
    expect(out).not.toContain("The chief executive");
    expect(out).toMatch(/^\[ROLE_1\] appreciated/);
    expect(out.match(/the surgeons/g)).toHaveLength(2);
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

describe("role references (ADR-0007)", () => {
  const tokensIn = (text: string) => text.match(/\[\w+_\d+\]/g) ?? [];

  it("gives a name and a roster role for the same person one token", () => {
    const p = createPseudonymizer(ROSTER);
    const source = caseById("role-name-and-role-same-person");
    const out = p.pseudonymize(source);

    expect(out).not.toMatch(/Piper|biomedical engineer/i);
    const tokens = tokensIn(out);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toBe(tokens[1]);
    expect(tokens[0]).toMatch(/^\[STAFF_/);
  });

  it("rehydrates per occurrence: the name where the name was, the role where the role was", () => {
    // The hard part of the roles decision. One token stands for two forms in this note,
    // and `mapping` alone cannot say which form goes where. The round-trip is exact.
    const p = createPseudonymizer(ROSTER);
    const source = caseById("role-name-and-role-same-person");
    const out = p.pseudonymize(source);
    expect(p.rehydrate(out)).toBe(source);
  });

  it("rehydrates a draft, which it did not produce, with the canonical form", () => {
    // The model places tokens where it likes; there is no "form written there". The token
    // comes back as the rostered person's name without titles.
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("role-name-and-role-same-person"));
    const token = tokensIn(out)[0]!;
    expect(p.rehydrate(`Dear ${token}, thank you for your time.`)).toBe(
      "Dear Tomas Piper, thank you for your time.",
    );
  });

  it("gives every form of one rostered person the same token", () => {
    // Full name, surname, and role are one identity. Before ADR-0007 the full name and the
    // surname were keyed on their text and got two tokens, which told the model two people
    // were in the room.
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(
      "Amara Okonjo-Baptiste opened the session. Okonjo-Baptiste then asked about the port.",
    );
    const tokens = tokensIn(out);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toBe(tokens[1]);
  });

  it("keeps a token stable across a batch when one instance is reused", () => {
    // Per-person batching depends on this: the role in the second note is the person named
    // in the first, and the model has to be told so.
    const p = createPseudonymizer(ROSTER);
    const first = p.pseudonymize("Piper asked about the cable run.");
    const second = p.pseudonymize("The biomedical engineer will measure the room.");
    expect(tokensIn(first)[0]).toBe(tokensIn(second)[0]);
    expect(p.rehydrate(first)).toBe("Piper asked about the cable run.");
    expect(p.rehydrate(second)).toBe("The biomedical engineer will measure the room.");
  });

  it("tokenizes a roster role two attendees share against the text as written", () => {
    // Two consultants on the roster. Which one "the consultant" means is not knowable, so
    // it gets a text-keyed token that rehydrates to the phrase — the shared-surname rule.
    const p = createPseudonymizer(ROSTER);
    const source = caseById("role-shared-roster-role");
    const out = p.pseudonymize(source);
    expect(out).toMatch(/^\[HCP_\d+\] asked/);
    expect(p.rehydrate(out)).toBe(source);
    // In a draft, a shared roster form rehydrates to the roster's own form.
    expect(p.rehydrate(`${tokensIn(out)[0]} will call.`)).toBe("Consultant will call.");
  });

  it("tokenizes a definite role the roster does not know, and leaves an indefinite one", () => {
    // adapted-3: "The director of finance and procurement" is nobody on the roster and is
    // fail-closed into a ROLE token; "a local engineer" in the same note picks out nobody.
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("adapted-3"));
    expect(out).toMatch(/^\[ROLE_1\] liked the flexibility/);
    expect(out).toContain("having a local engineer");
    expect(p.rehydrate(out)).toBe(caseById("adapted-3"));
  });

  it("tokenizes a capitalised role opening a sentence", () => {
    // adapted-2 opens "Clinical Engineering Lead really likes" with no determiner, which
    // is how the corpus writes a role used as a name.
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("adapted-2"));
    expect(out).toMatch(/^\[ROLE_1\] really likes/);
  });

  it("leaves indefinite references alone", () => {
    const p = createPseudonymizer(ROSTER);
    const source = caseById("role-indefinite");
    expect(p.pseudonymize(source)).toBe(source);
  });

  it("stops the of-tail before the verb", () => {
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("role-with-tail"));
    expect(out).toBe("[ROLE_1] said the quote needs two signatures.");
  });

  it("keeps the possessive outside the token", () => {
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("role-possessive"));
    expect(out).toBe("We left the sample kit in [ROLE_1]'s office.");
  });

  it("leaves `Nurse` in the title position to pass 2, and tokenizes `the nurse` as a role", () => {
    // The collision the prompt named. `Nurse` is both a word title and a role head noun.
    // Pass 2 runs first and owns the title position, so the name after it is tokenized and
    // the title stays — a profession, which §4.1 lets through. Lowercase `the nurse` is not
    // a title under ADR-0006's case rule and is a definite role reference here.
    const p = createPseudonymizer(ROSTER);
    const out = p.pseudonymize(caseById("role-nurse-title-position"));
    expect(out).toBe(
      "Nurse [PERSON_1] said the room was fine but [ROLE_1] on the late shift disagreed.",
    );
    expect(p.rehydrate(out)).toBe(caseById("role-nurse-title-position"));
  });

  it("the guard sees roles: a role-only tokenizer is not enough", () => {
    // The counterfactual, in the shape of the existing one for the structural rule. This
    // is what the tokenizer produced before ADR-0007 — names replaced, roles passed — and
    // the guard now refuses it.
    const namesOnly = (text: string): string => text.replace(/\bPiper\b/g, "[STAFF_1]");

    const source = caseById("role-name-and-role-same-person");
    const weakened = namesOnly(source);
    expect(weakened).toContain("the biomedical engineer");
    expect(() => assertPseudonymized(weakened, ROSTER)).toThrow(PseudonymizationError);

    // An unmatched role survives the same way.
    expect(() => assertPseudonymized(caseById("adapted-6"), ROSTER)).toThrow(
      PseudonymizationError,
    );

    // And the real tokenizer passes the guard on both.
    const p = createPseudonymizer(ROSTER);
    expect(() => assertPseudonymized(p.pseudonymize(source), ROSTER)).not.toThrow();
    expect(() =>
      assertPseudonymized(p.pseudonymize(caseById("adapted-6")), ROSTER),
    ).not.toThrow();
  });

  it("names the length of a caught role, never the role", () => {
    try {
      assertPseudonymized(caseById("adapted-6"), ROSTER);
      expect.unreachable("guard should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain("chief executive");
      expect(message).toContain("role reference");
    }
  });
});
