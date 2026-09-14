/**
 * The messy fixture through the parser, the header detector, the mapping guesses, and
 * the people it yields — what "a messy real-shaped `.xlsx` imports correctly" means.
 *
 * `tests/fixtures/roster-messy.xlsx` is built by `scripts/build-roster-fixture.mjs`; its
 * header comment lists the artifacts. Each assertion here names the artifact it covers.
 * The `.csv` and the `.xls` are its companions. All names are the synthetic roster's.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { detectFormat, FORMAT_REFUSALS } from "@/lib/roster/format";
import { detectHeader, guessMapping, peopleFrom } from "@/lib/roster/header";
import { parseRosterFile, RosterFormatError } from "@/lib/roster/parse";

const bytes = (name: string) =>
  readFileSync(join(process.cwd(), "tests", "fixtures", name));
const fixture = (name: string) => new Blob([bytes(name)]);

describe("format detection by magic bytes", () => {
  it("names each fixture by its first bytes, not its extension", () => {
    const head = (name: string) => new Uint8Array(bytes(name).subarray(0, 8));
    expect(detectFormat(head("roster-messy.xlsx"))).toBe("xlsx");
    expect(detectFormat(head("roster-legacy.xls"))).toBe("xls");
    expect(detectFormat(head("roster.csv"))).toBe("csv");
    expect(detectFormat(new Uint8Array([0, 1, 2, 3]))).toBe("unknown");
    expect(detectFormat(new Uint8Array([]))).toBe("unknown");
  });

  it("refuses an .xls with the instruction to re-save, before any parser runs", async () => {
    await expect(parseRosterFile(fixture("roster-legacy.xls"))).rejects.toMatchObject({
      name: "RosterFormatError",
      format: "xls",
    });
    expect(FORMAT_REFUSALS.xls).toMatch(/save it again as \.xlsx/);
  });

  it("refuses bytes that are neither", async () => {
    const error: unknown = await parseRosterFile(
      new Blob([new Uint8Array([0, 0, 0])]),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RosterFormatError);
    expect((error as RosterFormatError).format).toBe("unknown");
  });
});

describe("the messy .xlsx", () => {
  it("reads through read-excel-file with every cell a clean string", async () => {
    const { format, rows } = await parseRosterFile(fixture("roster-messy.xlsx"));
    expect(format).toBe("xlsx");
    // The numeric "#" column arrives as a string; the trailing-space cell is trimmed.
    expect(rows[4]![0]).toBe("1");
    expect(rows[9]![5]).toBe("Northgate Regional");
    for (const row of rows) for (const cell of row) expect(typeof cell).toBe("string");
  });

  it("finds the header under a banner and a blank row, and joins the merged cell's sub-labels", async () => {
    const { rows } = await parseRosterFile(fixture("roster-messy.xlsx"));
    const header = detectHeader(rows)!;
    expect(header).not.toBeNull();
    // Row 3 (index 2) is the header; row 4 is its continuation; data starts at row 5.
    expect(header.dataStart).toBe(4);
    expect(header.columns.slice(0, 6)).toEqual([
      "#",
      "Attendee Title",
      "Attendee Surname",
      "Role",
      "Department",
      "Hospital",
    ]);
    // The sheet's two trailing empty columns are not here: read-excel-file drops
    // trailing empties, so the artifact is handled before this code sees it. A column
    // with no header that the library does keep — one inside the used range — is named
    // by its letter and never guessed:
    expect(header.columns).toHaveLength(6);
    const inner = detectHeader([
      ["Name", "", "Role"],
      ["Dr Green", "x", "Registrar"],
    ])!;
    expect(inner.columns).toEqual(["Name", "Column B", "Role"]);
    expect(guessMapping(inner.columns).specialty).toBeNull();
  });

  it("guesses the mapping from the joined header text", async () => {
    const { rows } = await parseRosterFile(fixture("roster-messy.xlsx"));
    const header = detectHeader(rows)!;
    expect(guessMapping(header.columns)).toEqual({
      name: 2,
      givenName: null,
      title: 1,
      role: 3,
      specialty: 4,
      institution: 5,
    });
  });

  it("yields six people, skipping the blank row and the footer, with the title in the name", async () => {
    const { rows } = await parseRosterFile(fixture("roster-messy.xlsx"));
    const header = detectHeader(rows)!;
    const people = peopleFrom(rows, header, guessMapping(header.columns));
    expect(people.map((p) => p.displayName)).toEqual([
      "Dr Okonjo-Baptiste",
      "Dr Vance",
      "Vance",
      "Dr Green",
      "Mr Piper",
      "Dr Swelha",
    ]);
    expect(people[2]).toMatchObject({
      role: "Theatre coordinator",
      specialty: "",
      institution: "Northgate Regional",
    });
    expect(people[4]!.institution).toBe("Northgate Regional");
    // The title column decides the class: Dr is a clinician, Mr and no title are staff.
    expect(people.map((p) => p.kind)).toEqual([
      "hcp",
      "hcp",
      "staff",
      "hcp",
      "staff",
      "hcp",
    ]);
  });
});

describe("the .csv", () => {
  it("reads through the in-house reader, BOM and quoted comma included", async () => {
    const { format, rows } = await parseRosterFile(fixture("roster.csv"));
    expect(format).toBe("csv");
    expect(rows[0]).toEqual(["Name", "Job title", "Specialty", "Organisation"]);
    expect(rows[1]![0]).toBe("Okonjo-Baptiste, Dr Amara");
    const header = detectHeader(rows)!;
    const mapping = guessMapping(header.columns);
    expect(mapping).toMatchObject({ name: 0, role: 1, specialty: 2, institution: 3 });
    const people = peopleFrom(rows, header, mapping);
    expect(people).toHaveLength(4);
    expect(people[1]!.displayName).toBe("Dr Peter Vance");
  });
});
