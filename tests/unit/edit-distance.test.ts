/**
 * Levenshtein distance, against cases whose answer can be checked by hand, plus the two
 * properties an audit metric needs: symmetric, and zero only for identity.
 */

import { describe, expect, it } from "vitest";

import { editDistance } from "@/lib/review/edit-distance";

describe("editDistance", () => {
  it("is zero for identical text and the full length against empty", () => {
    expect(editDistance("", "")).toBe(0);
    expect(editDistance("same", "same")).toBe(0);
    expect(editDistance("", "four")).toBe(4);
    expect(editDistance("four", "")).toBe(4);
  });

  it("matches hand-checked cases", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("flaw", "lawn")).toBe(2);
    expect(editDistance("Thank you.", "Thank you!")).toBe(1);
  });

  it("counts a code point once", () => {
    expect(editDistance("a", "a\u{1F600}")).toBe(1);
  });

  it("is symmetric and non-zero for different text", () => {
    const generated = "Thank you for your time on the truck. [approved content required]";
    const exported = "Thank you for your time on the truck. I will send the dimensions.";
    expect(editDistance(generated, exported)).toBe(editDistance(exported, generated));
    expect(editDistance(generated, exported)).toBeGreaterThan(0);
  });

  it("handles a draft-sized text without blowing up", () => {
    const base = "Thank you for your time on the truck. ".repeat(60);
    expect(editDistance(base, `${base}Kind regards,`)).toBe("Kind regards,".length);
  });
});
