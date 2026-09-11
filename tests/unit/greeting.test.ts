/**
 * The composed greeting: exactly one, from the record, whatever the model wrote.
 *
 * `fieldnote-viw`. The two assertions the fix owes: a draft with no model salutation gets
 * exactly one greeting, and a draft where the model wrote one anyway ends up with
 * exactly one — the composed one — and none of the model's.
 */

import { describe, expect, it } from "vitest";

import { composeDraft, greetingFor, isSalutation } from "@/lib/generation/greeting";

const GREETING = "Dear Dr. Okonjo-Baptiste,";

function greetings(text: string): string[] {
  return text.split("\n").filter((line) => /^dear\b/i.test(line));
}

describe("greetingFor", () => {
  it("uses the display name as entered, title included", () => {
    expect(greetingFor({ displayName: "Dr. Okonjo-Baptiste" })).toBe(GREETING);
    expect(greetingFor({ displayName: " Tomas Piper " })).toBe("Dear Tomas Piper,");
    expect(greetingFor({ displayName: "R. Vasquez, theatre coordinator" })).toBe(
      "Dear R. Vasquez, theatre coordinator,",
    );
  });
});

describe("isSalutation", () => {
  it("recognises the forms a model writes and not a sentence", () => {
    for (const line of [
      "Dear [HCP_1],",
      "Hello [STAFF_2]:",
      "[PERSON_1],",
      "Hi there,",
    ]) {
      expect(isSalutation(line), line).toBe(true);
    }
    for (const line of [
      "Thank you for your time on the truck.",
      "Subject: Thank you",
      "It was good to meet you, and I hope the demonstration was useful, as you said,",
    ]) {
      expect(isSalutation(line), line).toBe(false);
    }
  });
});

describe("composeDraft", () => {
  it("adds exactly one greeting after the subject when the model wrote none", () => {
    const composed = composeDraft(
      "Subject: Thank you for joining us\n\nThank you for your time on the truck.\n\nKind regards,",
      GREETING,
    );
    expect(composed).toBe(
      "Subject: Thank you for joining us\n\nDear Dr. Okonjo-Baptiste,\n\nThank you for your time on the truck.\n\nKind regards,",
    );
    expect(greetings(composed)).toEqual([GREETING]);
  });

  it("replaces a salutation the model wrote anyway, leaving exactly one", () => {
    const composed = composeDraft(
      "Subject: Thank you\n\nDear Okonjo-Baptiste,\n\nThank you for your time.\n\nKind regards,",
      GREETING,
    );
    expect(composed).toBe(
      "Subject: Thank you\n\nDear Dr. Okonjo-Baptiste,\n\nThank you for your time.\n\nKind regards,",
    );
    expect(greetings(composed)).toEqual([GREETING]);
    expect(composed).not.toContain("Dear Okonjo-Baptiste,");
  });

  it("handles a draft with no subject line", () => {
    expect(composeDraft("Dear [HCP_1],\n\nThank you.", GREETING)).toBe(
      "Dear Dr. Okonjo-Baptiste,\n\nThank you.",
    );
    expect(composeDraft("Thank you.", GREETING)).toBe(
      "Dear Dr. Okonjo-Baptiste,\n\nThank you.",
    );
  });

  it("does not mistake the first sentence for a salutation", () => {
    const composed = composeDraft(
      "Subject: Thanks\n\nThank you for joining us on Thursday.\n\nKind regards,",
      GREETING,
    );
    expect(composed).toContain("Thank you for joining us on Thursday.");
    expect(greetings(composed)).toEqual([GREETING]);
  });

  it("leaves the sign-off alone: only the line after the subject can be a salutation", () => {
    const composed = composeDraft(
      "Subject: Thanks\n\nThank you.\n\nKind regards,",
      GREETING,
    );
    expect(composed.endsWith("Kind regards,")).toBe(true);
  });
});
