/**
 * The briefing's document model: sections in order, what each carries, what is omitted,
 * and that the dictated notes have no way in.
 */

import { describe, expect, it } from "vitest";

import {
  composeBriefing,
  expectedAttendanceLine,
  type BriefingInput,
} from "@/lib/briefing/compose";

import {
  BRIEFING_ATTENDEES,
  BRIEFING_CONTACTS,
  BRIEFING_EVENT,
  GENERATED_AT,
} from "../fixtures/briefing";

const input: BriefingInput = {
  event: BRIEFING_EVENT,
  contacts: BRIEFING_CONTACTS,
  attendees: BRIEFING_ATTENDEES,
  generatedAt: GENERATED_AT,
};

const textOf = (doc: ReturnType<typeof composeBriefing>) =>
  doc.sections
    .flatMap((s) => [
      s.heading,
      ...s.blocks.map((b) =>
        b.kind === "card"
          ? [b.title, ...b.lines].join("\n")
          : b.kind === "field"
            ? `${b.label}: ${b.text}`
            : b.text,
      ),
    ])
    .join("\n");

describe("composeBriefing", () => {
  it("lays the sections out in the plan's order", () => {
    const doc = composeBriefing(input);
    expect(doc.sections.map((s) => s.heading)).toEqual([
      "Event",
      "Contacts",
      "Attendees",
      "Contingency plan",
    ]);
    expect(doc.title).toBe(BRIEFING_EVENT.name);
  });

  it("carries the dossier as labelled fields, the contacts as cards, and the contingency last", () => {
    const doc = composeBriefing(input);
    const text = textOf(doc);
    expect(text).toContain("Objectives: " + BRIEFING_EVENT.objectives);
    expect(text).toContain("Site: " + BRIEFING_EVENT.siteLabel);
    expect(text).toContain("Date: 2 October 2026");
    const contacts = doc.sections[1]!.blocks;
    expect(contacts).toHaveLength(3);
    expect(contacts[0]).toMatchObject({
      kind: "card",
      title: "Priya Anand",
      lines: ["Site coordinator", "01234 567890", "Meets us at the loading bay."],
    });
    expect(doc.sections[3]!.blocks[0]).toEqual({
      kind: "paragraph",
      text: BRIEFING_EVENT.contingency,
    });
  });

  it("lists attendees by name with the record's fields, the photo, and her notes, under the expected-attendance line", () => {
    const doc = composeBriefing(input);
    const [line, ...cards] = doc.sections[2]!.blocks;
    expect(line).toMatchObject({ kind: "paragraph" });
    expect((line as { text: string }).text).toContain(
      expectedAttendanceLine(GENERATED_AT),
    );
    expect((line as { text: string }).text).toContain("will not appear here");
    expect(cards.map((c) => (c as { title: string }).title)).toEqual([
      "Dr. Amara Okonjo-Baptiste",
      "Dr. Peter Vance",
      "Dr. Ruth Green",
      "Marisol Vance",
      "Tomas Piper",
    ]);
    const vance = cards[1] as { lines: readonly string[]; image: unknown };
    expect(vance.lines[0]).toBe("Consultant · Upper GI · Northgate Regional");
    expect(vance.lines[1]).toContain("trolley question");
    expect(vance.image).not.toBeNull();
    expect((cards[0] as { image: unknown }).image).toBeNull();
  });

  it("omits an empty dossier field and says so when nothing was entered", () => {
    const bare = composeBriefing({
      ...input,
      event: {
        ...BRIEFING_EVENT,
        siteLabel: "",
        startsAt: null,
        objectives: "",
        configuration: "",
        itinerary: "",
        logistics: "",
        contingency: "  ",
      },
      contacts: [],
      attendees: [],
    });
    expect(bare.sections[0]!.blocks).toEqual([
      { kind: "paragraph", text: "Nothing entered." },
    ]);
    expect(bare.sections[1]!.blocks).toEqual([
      { kind: "paragraph", text: "Nothing entered." },
    ]);
    expect(bare.sections[2]!.blocks.at(-1)).toEqual({
      kind: "paragraph",
      text: "Nobody is listed yet.",
    });
    expect(bare.sections[3]!.blocks).toEqual([
      { kind: "paragraph", text: "Nothing entered." },
    ]);
  });

  it("states its limits in the footer, with the event and the generation time", () => {
    const doc = composeBriefing(input);
    expect(doc.footer.event).toContain(BRIEFING_EVENT.name);
    expect(doc.footer.event).toContain("Generated 15 September 2026");
    expect(doc.footer.attendance).toBe(
      "Attendee list is expected attendance as of 15 September 2026.",
    );
  });

  it("has no way to receive the dictated notes", () => {
    // `satisfies` fails to compile if BriefingInput ever gains a notes key.
    const keys = {
      event: true,
      contacts: true,
      attendees: true,
      generatedAt: true,
    } satisfies Record<keyof BriefingInput, true>;
    expect(Object.keys(keys)).not.toContain("notes");
  });
});
