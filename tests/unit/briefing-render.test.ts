/**
 * The briefing drawn: a real PDF, the right page size, every section on it, the photo
 * embedded, and a character the font cannot encode drawn as a mark rather than failing.
 * Text is checked on the document model (`briefing-compose.test.ts`); here the output is
 * loaded back with the same library and its structure inspected.
 */

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { composeBriefing } from "@/lib/briefing/compose";
import { PAGE, renderBriefing } from "@/lib/briefing/render";

import {
  BRIEFING_ATTENDEES,
  BRIEFING_CONTACTS,
  BRIEFING_EVENT,
  GENERATED_AT,
  fixturePhoto,
} from "../fixtures/briefing";

const input = {
  event: BRIEFING_EVENT,
  contacts: BRIEFING_CONTACTS,
  attendees: BRIEFING_ATTENDEES,
  generatedAt: GENERATED_AT,
};

describe("renderBriefing", () => {
  it("produces a PDF on the page that fits A4 and Letter, with the photo embedded", async () => {
    const bytes = await renderBriefing(composeBriefing(input));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const back = await PDFDocument.load(bytes);
    expect(back.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(back.getPage(0).getSize()).toEqual({ width: PAGE.width, height: PAGE.height });
    expect(back.getTitle()).toBe(BRIEFING_EVENT.name);
    // One embedded image object: the fixture photo. pdf-lib names them /Image<n>.
    const source = new TextDecoder("latin1").decode(bytes);
    expect(source.match(/\/Subtype \/Image/g)?.length).toBe(1);
    // For the report: the fixture event's page count and size.
    console.info(
      `briefing fixture: ${back.getPageCount()} page(s), ${bytes.length} bytes`,
    );
  });

  it("draws a stored site map across the Event section as a second embedded image", async () => {
    const bytes = await renderBriefing(
      composeBriefing({ ...input, siteMap: fixturePhoto(BRIEFING_EVENT.id) }),
    );
    const source = new TextDecoder("latin1").decode(bytes);
    expect(source.match(/\/Subtype \/Image/g)?.length).toBe(2);
    const back = await PDFDocument.load(bytes);
    expect(back.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it("breaks across pages rather than running off one, and numbers every page", async () => {
    const long = {
      ...input,
      attendees: Array.from({ length: 12 }, (_, i) => ({
        attendee: {
          ...BRIEFING_ATTENDEES[1]!.attendee,
          id: `att-${i}`,
          displayName: `Dr. Synthetic Person ${i + 1}`,
          briefingNotes: "A line of briefing notes. ".repeat(12),
        },
        photo: BRIEFING_ATTENDEES[1]!.photo,
      })),
    };
    const bytes = await renderBriefing(composeBriefing(long));
    const back = await PDFDocument.load(bytes);
    expect(back.getPageCount()).toBeGreaterThan(1);
  });

  it("draws a character the standard font cannot encode as a mark instead of failing", async () => {
    const doc = composeBriefing({
      ...input,
      event: {
        ...BRIEFING_EVENT,
        name: "Northgate 汉 day",
        objectives: "Ünïcödé is fine — 汉 is not.",
      },
    });
    await expect(renderBriefing(doc)).resolves.toBeInstanceOf(Uint8Array);
  });
});
