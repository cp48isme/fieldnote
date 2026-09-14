/**
 * Every cell that comes out of a parser is hostile until it has been through here.
 * ADR-0003's residual risk, as the operating rule: the parser is an attack surface,
 * and what it returns is validated and normalised before it reaches Dexie or a screen.
 *
 * A cell becomes a string or nothing. Numbers and booleans are written out; dates are
 * written as ISO dates, because a sign-in sheet has no field that should hold one and a
 * date in a name column is a mapping mistake the representative should be able to see;
 * anything else — an object, a function, whatever a parser might hand back — is dropped.
 * Then: control characters removed (a tab or newline inside a name is never intended),
 * whitespace collapsed, trimmed, and capped at a length no name, role, or institution
 * needs, so a cell holding a paragraph cannot become a display name.
 */

export const MAX_CELL_LENGTH = 120;

/** C0 and C1 control characters, and the Unicode line and paragraph separators. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/g;

export function cleanCell(value: unknown): string {
  let text: string;
  if (typeof value === "string") text = value;
  else if (typeof value === "number") text = Number.isFinite(value) ? String(value) : "";
  else if (typeof value === "boolean") text = value ? "true" : "false";
  else if (value instanceof Date) {
    text = Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  } else return "";

  return text.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CELL_LENGTH);
}

/** A row of cleaned cells. Trailing empty cells are kept: column positions matter. */
export function cleanRow(row: readonly unknown[]): string[] {
  return row.map(cleanCell);
}
