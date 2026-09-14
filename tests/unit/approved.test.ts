/**
 * The approved-copy matcher: exact, whole passage, after normalisation, and nothing
 * looser. Every passage here is invented about the synthetic device.
 */

import { describe, expect, it } from "vitest";

import {
  libraryVersionOf,
  normaliseText,
  protectApproved,
  refusalFor,
  restoreApproved,
} from "@/lib/generation/approved";
import { applyGuardrails, GUARDRAIL_RULESET_VERSION } from "@/lib/generation/guardrails";
import { GAP_MARKER } from "@/lib/generation/prompt";

// Product nouns and descriptors the classifier knows, so each passage is claim-bearing
// on its own — which is the point of the exemption.
const PANEL = {
  id: "p-panel",
  body: "The open control console sits at eye level and is designed to move between rooms on its own stand.",
};
const SENSOR = {
  id: "p-sensor",
  body: "The sensor module is supplied as a matched pair and allows a check before every case.",
};
const LIBRARY = [PANEL, SENSOR];
/** The placeholder as `approved.ts` writes it: U+0001, the index, U+0001. */
const MARK = (n: number) => `\u0001${n}\u0001`;

describe("normaliseText", () => {
  it("collapses whitespace and folds quotes and dashes, keeping case", () => {
    expect(normaliseText("  The   open\n control – panel’s “stand” … ")).toBe(
      // An ellipsis is left alone: the fold keeps every index where it was.
      'The open control - panel\'s "stand" …',
    );
    expect(normaliseText("The Panel")).not.toBe(normaliseText("the panel"));
  });
});

describe("protectApproved and restoreApproved", () => {
  it("finds a passage the model copied exactly, however it was spaced", () => {
    const text = `Thank you for your time.  ${PANEL.body.replace("its own", "its\nown")} I hope that helps.`;
    const { text: held, used, table } = protectApproved(text, LIBRARY);
    expect(used).toEqual(["p-panel"]);
    // The rest of the text is untouched — the double space stays — and the passage is
    // restored as the library wrote it, not as the model spaced it.
    expect(held).toBe(`Thank you for your time.  ${MARK(0)} I hope that helps.`);
    expect(restoreApproved(held, table)).toBe(
      `Thank you for your time.  ${PANEL.body} I hope that helps.`,
    );
  });

  it("keeps the model's paragraph breaks and matches across a wrapped line", () => {
    const wrapped = PANEL.body.replace("and is designed", "and\nis designed");
    const text = `Subject: Thanks\n\nThank you.\n\n${wrapped}\n\nKind regards,`;
    const held = protectApproved(text, LIBRARY);
    expect(held.used).toEqual(["p-panel"]);
    expect(held.text).toBe(
      `Subject: Thanks\n\nThank you.\n\n${MARK(0)}\n\nKind regards,`,
    );
  });

  it("does not match a passage reworded by one word, a fragment, a longer word, or a case change", () => {
    expect(
      protectApproved(PANEL.body.replace("eye level", "eye height"), LIBRARY).used,
    ).toEqual([]);
    expect(
      protectApproved("The open control console sits at eye level.", LIBRARY).used,
    ).toEqual([]);
    expect(protectApproved(`${SENSOR.body.slice(0, -1)}s.`, LIBRARY).used).toEqual([]);
    expect(protectApproved(PANEL.body.toLowerCase(), LIBRARY).used).toEqual([]);
  });

  it("reports each passage once, in order of first appearance, and holds them out of the rules", () => {
    const text = `${SENSOR.body} As you asked: ${PANEL.body} Again: ${SENSOR.body}`;
    const held = protectApproved(text, LIBRARY);
    expect(held.used).toEqual(["p-sensor", "p-panel"]);
    // Both passages are claim-bearing in the sender's voice and would be blanked alone.
    expect(applyGuardrails(PANEL.body).text).toBe(GAP_MARKER);
    expect(applyGuardrails(SENSOR.body).text).toBe(GAP_MARKER);
    const guarded = applyGuardrails(held.text);
    expect(guarded.flagsFired).toEqual([]);
    expect(restoreApproved(guarded.text, held.table)).toBe(text);
  });

  it("leaves a placeholder it did not write alone, so text protected twice is not confused", () => {
    const once = protectApproved(`${PANEL.body} And more.`, LIBRARY);
    const twice = protectApproved(once.text, [SENSOR]);
    expect(twice.used).toEqual([]);
    expect(twice.text).toBe(once.text);
    expect(restoreApproved(twice.text, once.table)).toBe(`${PANEL.body} And more.`);
  });

  it("blanks a reworded passage as claim-bearing while an exact one beside it passes", () => {
    const reworded = PANEL.body.replace("eye level", "eye height");
    const held = protectApproved(`${SENSOR.body} ${reworded}`, LIBRARY);
    const guarded = applyGuardrails(held.text);
    expect(guarded.flagsFired).toEqual(["claim-bearing"]);
    expect(restoreApproved(guarded.text, held.table)).toBe(
      `${SENSOR.body} ${GAP_MARKER}`,
    );
    expect(GUARDRAIL_RULESET_VERSION).toBe("1.3.0");
  });
});

describe("libraryVersionOf", () => {
  it("is null for an empty library, stable across order, and changes with a body", async () => {
    expect(await libraryVersionOf([])).toBeNull();
    const a = await libraryVersionOf([PANEL, SENSOR]);
    expect(a).toBe(await libraryVersionOf([SENSOR, PANEL]));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(
      await libraryVersionOf([PANEL, { ...SENSOR, body: `${SENSOR.body} Also.` }]),
    ).not.toBe(a);
  });
});

describe("refusalFor", () => {
  it("accepts claim-bearing and regulatory language, which is what approved copy is", () => {
    expect(refusalFor(PANEL.body)).toBeNull();
    expect(
      refusalFor(
        "The sensor set is cleared for use in the adult population; refer to the instructions for use.",
      ),
    ).toBeNull();
  });

  it("refuses a meal, a price, a patient, and a name after a title, naming the rule", () => {
    expect(refusalFor("We would be glad to host dinner after the demonstration.")).toBe(
      "hospitality",
    );
    expect(
      refusalFor("The tooling kit is available at a 15% reduction this quarter."),
    ).toBe("pricing");
    expect(refusalFor("Your 54-year-old patient would be a good first case.")).toBe(
      "patient",
    );
    expect(refusalFor("Dr. Marlow mentioned the same concern last month.")).toBe(
      "invented-name",
    );
  });
});
