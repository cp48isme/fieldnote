/**
 * Finding the header in a sheet that was never designed to be parsed, and guessing
 * which column is which.
 *
 * Sign-in sheets never have consistent headers, and ADR-0003 warns that
 * `read-excel-file` has not absorbed a decade of pathological spreadsheets: it ignores
 * merged cells, so a merged header cell arrives as its text in the first column of the
 * span and empty cells in the rest. What this module handles, each of which the messy
 * fixture (`tests/fixtures/roster-messy.xlsx`) contains:
 *
 *   - **Stray rows above the header** — a title banner, a blank line. The header is the
 *     first row with at least two non-empty cells.
 *   - **A merged header cell with sub-labels underneath** — "Attendee" spanning two
 *     columns, "Title" and "Surname" on the row below. A row is a continuation of the
 *     header when every non-empty cell in it sits inside a span: a non-empty header cell
 *     followed by one or more empty ones. The sub-label is joined to the span's text, so
 *     the columns read "Attendee Title" and "Attendee Surname".
 *   - **Blank rows and unlabelled columns** — a row with no name is not a person; a
 *     column with no header is offered as "Column B" and never guessed. Trailing empty
 *     columns never arrive: `read-excel-file` drops them before this code runs.
 *
 * The guesses are by header text, and they are guesses: the representative sees them
 * pre-selected and changes them. A wrong guess costs a tap; no guess would cost the
 * whole mapping every time.
 */

import { kindFromTitle, type AttendeeKind } from "@/lib/db";

export type RosterField =
  "name" | "givenName" | "title" | "role" | "specialty" | "institution";

export const ROSTER_FIELDS: readonly RosterField[] = [
  "name",
  "givenName",
  "title",
  "role",
  "specialty",
  "institution",
];

/** Column index per field, or null for "not on this sheet". Only `name` is required. */
export type ColumnMapping = Record<RosterField, number | null>;

export interface DetectedHeader {
  /** Index of the first data row in the original rows. */
  dataStart: number;
  /** One label per column, "Column C" where the sheet had none. */
  columns: string[];
}

const nonEmpty = (row: readonly string[]) => row.filter((cell) => cell.length > 0).length;

/** Excel's own column letters, so an unlabelled column is named the way the sheet shows it. */
export function columnLetter(index: number): string {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

/** The spans of a header row: each non-empty cell and the run of empty cells after it. */
function spansOf(header: readonly string[]): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  for (let c = 0; c < header.length; c += 1) {
    if (header[c]!.length === 0) continue;
    let end = c;
    while (end + 1 < header.length && header[end + 1]!.length === 0) end += 1;
    spans.push({ start: c, end });
  }
  return spans;
}

function isContinuation(header: readonly string[], row: readonly string[]): boolean {
  if (nonEmpty(row) === 0) return false;
  const spans = spansOf(header).filter((span) => span.end > span.start);
  return row.every(
    (cell, c) =>
      cell.length === 0 || spans.some((span) => c >= span.start && c <= span.end),
  );
}

export function detectHeader(rows: readonly string[][]): DetectedHeader | null {
  const width = Math.max(0, ...rows.map((row) => row.length));
  const pad = (row: readonly string[]) => [
    ...row,
    ...Array<string>(width - row.length).fill(""),
  ];

  const headerAt = rows.findIndex((row) => nonEmpty(row) >= 2);
  if (headerAt === -1) return null;

  const header = pad(rows[headerAt]!);
  let dataStart = headerAt + 1;
  const columns = [...header];

  // Sub-labels under a merged cell: "Attendee" over "Title" and "Surname".
  while (dataStart < rows.length && isContinuation(header, pad(rows[dataStart]!))) {
    const sub = pad(rows[dataStart]!);
    for (const span of spansOf(header)) {
      if (span.end === span.start) continue;
      for (let c = span.start; c <= span.end; c += 1) {
        if (sub[c]!.length > 0) columns[c] = `${header[span.start]} ${sub[c]}`.trim();
      }
    }
    dataStart += 1;
  }

  return {
    dataStart,
    columns: columns.map((label, c) =>
      label.length > 0 ? label : `Column ${columnLetter(c)}`,
    ),
  };
}

/**
 * Header words that name a field. Order matters where a header could mean two, and a
 * "Job title" is a role, not a salutation: the title guess declines any header that
 * also says job, position, or role.
 */
const NOT_A_SALUTATION = /\b(?:job|position|role)\b/i;
const GUESSES: ReadonlyArray<[RosterField, (label: string) => boolean]> = [
  [
    "title",
    (label) =>
      /\b(?:title|salutation|prefix|dr\s*\/\s*mr|honorific)\b/i.test(label) &&
      !NOT_A_SALUTATION.test(label),
  ],
  ["givenName", (label) => /\b(?:first\s*name|given\s*name|forename)\b/i.test(label)],
  [
    "name",
    (label) =>
      /\b(?:surname|last\s*name|family\s*name|full\s*name|attendee\s*name|name|attendee|delegate|participant)\b/i.test(
        label,
      ),
  ],
  ["role", (label) => /\b(?:role|job|position|grade|occupation|title)\b/i.test(label)],
  [
    "specialty",
    (label) =>
      /\b(?:special(?:i?ty|ism)|department|dept|discipline|service)\b/i.test(label),
  ],
  [
    "institution",
    (label) =>
      /\b(?:institution|hospital|trust|site|organi[sz]ation|employer|practice|company)\b/i.test(
        label,
      ),
  ],
];

export function guessMapping(columns: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    name: null,
    givenName: null,
    title: null,
    role: null,
    specialty: null,
    institution: null,
  };
  const taken = new Set<number>();
  for (const [field, matches] of GUESSES) {
    const index = columns.findIndex(
      (label, c) => !taken.has(c) && !/^Column [A-Z]+$/.test(label) && matches(label),
    );
    if (index !== -1) {
      mapping[field] = index;
      taken.add(index);
    }
  }
  return mapping;
}

/** One person as the sheet describes them, after mapping. */
export interface ImportedPerson {
  /** Index of the source row, for the review screen. */
  row: number;
  /** Composed: title, given name, name — so the greeting keeps its title. */
  displayName: string;
  /** `hcp` when the mapped title column reads Dr or Prof; otherwise `staff`. */
  kind: AttendeeKind;
  role: string;
  specialty: string;
  institution: string;
}

/** The title rule lives in `src/lib/db/attendee-kind.ts`, shared with the dock's path. */
export { kindFromTitle };

const cellAt = (row: readonly string[], index: number | null) =>
  index === null ? "" : (row[index] ?? "");

/**
 * The data rows through the mapping. A row with nothing in the name column is not a
 * person — a blank line, a "Total: 6" footer — and is skipped rather than imported as
 * someone with no name.
 */
export function peopleFrom(
  rows: readonly string[][],
  header: DetectedHeader,
  mapping: ColumnMapping,
): ImportedPerson[] {
  if (mapping.name === null) return [];
  const people: ImportedPerson[] = [];
  for (let r = header.dataStart; r < rows.length; r += 1) {
    const row = rows[r]!;
    const surname = cellAt(row, mapping.name);
    if (surname.length === 0) continue;
    const displayName = [
      cellAt(row, mapping.title),
      cellAt(row, mapping.givenName),
      surname,
    ]
      .filter((part) => part.length > 0)
      .join(" ");
    people.push({
      row: r,
      displayName,
      kind: kindFromTitle(cellAt(row, mapping.title)),
      // ADR-0007: whatever lands in `role` is what the tokenizer's role pass matches
      // against, word for word. A sheet's "Consultant" column becomes a roster role.
      role: cellAt(row, mapping.role),
      specialty: cellAt(row, mapping.specialty),
      institution: cellAt(row, mapping.institution),
    });
  }
  return people;
}
