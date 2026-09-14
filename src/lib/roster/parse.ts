/**
 * A file to rows of clean strings. The one place `read-excel-file` is called.
 *
 * Everything the file could contain has been through `cleanCell` by the time it leaves
 * here: the caller sees `string[][]` and nothing else. The first sheet is read; a
 * sign-in sheet is one sheet, and a workbook with more is a mapping question for the
 * representative that this session does not ask.
 *
 * The file never leaves the device: both readers take the bytes the browser already
 * has, and `tests/e2e/roster-import.spec.ts` records every request during an import to
 * show that nothing but same-origin assets was fetched.
 */

import { readSheet } from "read-excel-file/browser";

import { parseCsv } from "./csv";
import { detectFormat, type RosterFormat } from "./format";
import { cleanRow } from "./sanitize";

export interface ParsedRoster {
  format: Extract<RosterFormat, "xlsx" | "csv">;
  rows: string[][];
}

export class RosterFormatError extends Error {
  constructor(readonly format: Exclude<RosterFormat, "xlsx" | "csv">) {
    super(`unsupported roster format: ${format}`);
    this.name = "RosterFormatError";
  }
}

/** How many bytes the format check needs. */
const HEAD_LENGTH = 8;

export async function parseRosterFile(file: Blob): Promise<ParsedRoster> {
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer, 0, Math.min(HEAD_LENGTH, buffer.byteLength));
  const format = detectFormat(head);
  if (format === "xls" || format === "unknown") throw new RosterFormatError(format);

  if (format === "csv") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return { format, rows: parseCsv(text).map(cleanRow) };
  }

  const data = await readSheet(buffer);
  return { format, rows: data.map((row) => cleanRow(row)) };
}
