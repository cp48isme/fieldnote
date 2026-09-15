/**
 * The calendar file, line by line against the fixture event. There is no parser to
 * round-trip through; the assertion is the text the RFC calls for.
 */

import { describe, expect, it } from "vitest";

import {
  buildIcs,
  canBuildIcs,
  escapeText,
  foldLine,
  formatUtc,
} from "@/lib/calendar/ics";

import { BRIEFING_EVENT } from "../fixtures/briefing";

const STAMP = Date.UTC(2026, 8, 15, 9, 45, 30);

describe("buildIcs", () => {
  it("writes one VEVENT for the fixture event, folded and escaped, CRLF-terminated", () => {
    const ics = buildIcs({ event: BRIEFING_EVENT, stampedAt: STAMP })!;
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.split("\r\n").slice(0, -1)).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Fieldnote//Pre-event email//EN",
      "BEGIN:VEVENT",
      "UID:event-briefing@fieldnote.invalid",
      "DTSTAMP:20260915T094530Z",
      "DTSTART:20261002T080000Z",
      "DTEND:20261002T160000Z",
      "SUMMARY:Northgate demonstration day",
      "LOCATION:Northgate Regional Hospital\\, 12 Ridge Road",
      "GEO:51.500700;-0.124600",
      // Folded at 75 octets, the continuation's leading space counted: 75, then 1 + 74.
      "DESCRIPTION:Northgate Regional Hospital\\, 12 Ridge Road\\nApple Maps: https:",
      " //maps.apple.com/?ll=51.500700\\,-0.124600&q=51.500700\\,-0.124600\\nGoogle M",
      " aps: https://www.google.com/maps/search/?api=1&query=51.500700\\,-0.124600",
      "END:VEVENT",
      "END:VCALENDAR",
    ]);
    // No bare LF anywhere, and no free text: the logistics stay in the email.
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    expect(ics).not.toContain(BRIEFING_EVENT.logistics.slice(0, 20));
    expect(ics).not.toMatch(/ATTENDEE|ORGANIZER/);
  });

  it("needs both ends, and omits location lines it has nothing for", () => {
    expect(
      buildIcs({ event: { ...BRIEFING_EVENT, endsAt: null }, stampedAt: STAMP }),
    ).toBeNull();
    expect(
      buildIcs({ event: { ...BRIEFING_EVENT, startsAt: null }, stampedAt: STAMP }),
    ).toBeNull();
    expect(canBuildIcs(BRIEFING_EVENT)).toBe(true);
    expect(canBuildIcs({ ...BRIEFING_EVENT, endsAt: null })).toBe(false);
    const bare = buildIcs({
      event: { ...BRIEFING_EVENT, address: "", coordinates: "" },
      stampedAt: STAMP,
    })!;
    expect(bare).not.toMatch(/LOCATION|GEO|DESCRIPTION/);
    expect(bare).toContain("SUMMARY:Northgate demonstration day\r\n");
    // A semicolon in a name is escaped in the file — CodeQL caught the first version of
    // this replacing ";" with itself, which the fixture, having none, could not.
    const withSemicolon = buildIcs({
      event: { ...BRIEFING_EVENT, name: "Northgate; bay 3" },
      stampedAt: STAMP,
    })!;
    expect(withSemicolon).toContain("SUMMARY:Northgate\\; bay 3\r\n");
  });

  it("escapes the four characters the RFC names, and folds at 75 octets counting the space", () => {
    // Every escape doubled here is one backslash in the file: `\;`, `\,`, `\\`, `\n`.
    expect(escapeText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
    expect(escapeText("a;b")).toHaveLength(4);
    expect(foldLine("x".repeat(75))).toBe("x".repeat(75));
    expect(foldLine("x".repeat(76))).toBe(`${"x".repeat(75)}\r\n x`);
    expect(foldLine("x".repeat(150))).toBe(
      `${"x".repeat(75)}\r\n ${"x".repeat(74)}\r\n x`,
    );
    // Multi-byte characters are never split: "é" is two octets.
    const folded = foldLine("é".repeat(40));
    expect(folded).toBe(`${"é".repeat(37)}\r\n ${"é".repeat(3)}`);
    expect(formatUtc(Date.UTC(2026, 0, 5, 7, 8, 9, 500))).toBe("20260105T070809Z");
  });
});
