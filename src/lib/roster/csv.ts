/**
 * A CSV reader, RFC 4180 with the tolerances a sign-in sheet needs.
 *
 * In-house because `read-excel-file` reads `.xlsx` only — ADR-0003 and the guide said it
 * had a separate CSV entry point, and at 9.3.10 it does not; the ADR carries a dated note.
 * ADR-0003's argument against writing a parser in-house was about binary spreadsheet
 * formats, whose failure modes are subtle; a comma-separated text file is forty lines
 * with no format to get wrong, and a dependency for it would be a dependency.
 *
 * Handles: quoted fields, doubled quotes inside them, line breaks inside quotes, CRLF and
 * LF, a leading byte-order mark, and a delimiter guessed from the first line among
 * comma, semicolon, and tab — Excel writes semicolons in half of Europe. Every value is
 * returned as a string; `sanitize.ts` cleans it afterwards like any other cell.
 */

const DELIMITERS = [",", ";", "\t"] as const;
const BYTE_ORDER_MARK = "\uFEFF";

/** The delimiter that appears most on the first line; comma when none does. */
export function guessDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let best: string = ",";
  let bestCount = 0;
  for (const candidate of DELIMITERS) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(input: string, delimiter = guessDelimiter(input)): string[][] {
  const text = input.startsWith(BYTE_ORDER_MARK) ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
