/**
 * What kind of file this is, from its first bytes, never from its name.
 *
 * ADR-0003, consequence added 2026-09-01: `read-excel-file` reads the OOXML `.xlsx`
 * format only, so a legacy binary `.xls` must be detected and refused with an
 * instruction to re-save, not fed to the parser to fail in a way that looks like a bug.
 * The extension is what the sender typed, and an `.xlsx` that is really an `.xls` is
 * exactly the file that arrives from a desktop copy of Office saved years ago. The magic
 * bytes are the file's own statement.
 *
 *   - `PK 03 04` — a ZIP container, which is what an `.xlsx` is.
 *   - `D0 CF 11 E0 A1 B1 1A E1` — an OLE2 compound file, which is what an `.xls` is.
 *   - Otherwise, text without NUL bytes is read as CSV; anything else is refused.
 */

export type RosterFormat = "xlsx" | "xls" | "csv" | "unknown";

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

export function detectFormat(head: Uint8Array): RosterFormat {
  if (startsWith(head, ZIP)) return "xlsx";
  if (startsWith(head, OLE2)) return "xls";
  if (head.length > 0 && !head.includes(0)) return "csv";
  return "unknown";
}

/** What the representative reads when a format is refused. */
export const FORMAT_REFUSALS: Record<Exclude<RosterFormat, "xlsx" | "csv">, string> = {
  xls: "This is an older Excel file (.xls). Open it in Excel and save it again as .xlsx, then import that file.",
  unknown:
    "This file is not a spreadsheet or a CSV that can be read here. Export the sign-in sheet as .xlsx or .csv and try again.",
};
