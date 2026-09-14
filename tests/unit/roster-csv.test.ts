/** The in-house CSV reader against the shapes Excel exports and people type by hand. */

import { describe, expect, it } from "vitest";

import { guessDelimiter, parseCsv } from "@/lib/roster/csv";
import { cleanCell } from "@/lib/roster/sanitize";

describe("parseCsv", () => {
  it("splits fields and rows, CRLF or LF", () => {
    expect(parseCsv("a,b\r\nc,d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps a quoted comma, a doubled quote, and a line break inside quotes", () => {
    expect(parseCsv('"Okonjo-Baptiste, Dr","said ""hi""","two\nlines"\n')).toEqual([
      ["Okonjo-Baptiste, Dr", 'said "hi"', "two\nlines"],
    ]);
  });

  it("strips a byte-order mark and guesses semicolons and tabs", () => {
    expect(parseCsv("\uFEFFa;b\nc;d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(guessDelimiter("a\tb\tc\n")).toBe("\t");
    expect(guessDelimiter("a,b;c\n")).toBe(",");
    expect(guessDelimiter("plain\n")).toBe(",");
  });

  it("keeps empty fields so column positions hold", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
  });
});

describe("cleanCell", () => {
  it("coerces what a parser hands back and drops what it should not", () => {
    expect(cleanCell("  Dr  Green ")).toBe("Dr Green");
    expect(cleanCell(42)).toBe("42");
    expect(cleanCell(true)).toBe("true");
    expect(cleanCell(new Date(Date.UTC(2026, 8, 14)))).toBe("2026-09-14");
    expect(cleanCell(null)).toBe("");
    expect(cleanCell({ toString: () => "object" })).toBe("");
    expect(cleanCell(Number.NaN)).toBe("");
  });

  it("removes control characters and caps the length", () => {
    expect(cleanCell("Dr\u0001\u0002 Green\tConsultant ")).toBe("Dr Green Consultant");
    expect(cleanCell("x".repeat(500))).toHaveLength(120);
  });
});
