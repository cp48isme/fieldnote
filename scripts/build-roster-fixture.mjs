#!/usr/bin/env node
/**
 * Builds the messy sign-in sheet fixture, `tests/fixtures/roster-messy.xlsx`, and its
 * two companions. Run with `node scripts/build-roster-fixture.mjs`; the outputs are
 * committed, and this script is how they were made, so they can be remade.
 *
 * WHY A SCRIPT AND NOT A FILE SAVED FROM EXCEL. A binary fixture with no source is a
 * fixture nobody can inspect, and this repository's rule is that every name is invented
 * (ADR-0001) — the names here are the synthetic roster's, and this file is the proof.
 *
 * WHY NO LIBRARY. An `.xlsx` is a ZIP of XML. The ZIP is written here with the "stored"
 * method — no compression, a CRC-32, local headers, a central directory — which is a
 * hundred lines and needs nothing from `node_modules`. `read-excel-file` reads what it
 * produces (`tests/unit/roster-parse.test.ts` proves it), and the point of ADR-0003 was
 * to trust a smaller thing, not to add a writer.
 *
 * WHAT THE SHEET CONTAINS, each artifact named in the parser's header comment:
 *
 *   row 1   a title banner merged across A1:F1
 *   row 2   blank
 *   row 3   the header, with "Attendee" merged across B3:C3 and two empty trailing columns
 *   row 4   sub-labels under the merged cell: "Title", "Surname"
 *   rows 5+ people, with a blank row in the middle, a numeric "#" column, a cell with
 *           trailing spaces, and a "Total attendees" footer with no name
 *
 * The `.csv` is the same people through a comma-separated export with a quoted field
 * and a BOM, as Excel writes it. The `.xls` is eight OLE2 magic bytes and padding: enough
 * for the format check to refuse it, which is all the test needs — no real `.xls` is
 * committed because no real `.xls` is ever read.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "tests", "fixtures");

// --- The sheet -------------------------------------------------------------------------

/** Cells per row, A first. A number is written as a number; a string as an inline string. */
const ROWS = [
  ["Northgate demonstration day — sign-in sheet"],
  [],
  ["#", "Attendee", null, "Role", "Department", "Hospital", null, null],
  [null, "Title", "Surname"],
  [1, "Dr", "Okonjo-Baptiste", "Consultant", "Colorectal", "Northgate Regional"],
  [2, "Dr", "Vance", "Consultant", "Upper GI", "Northgate Regional"],
  [3, null, "Vance", "Theatre coordinator", null, "Northgate Regional"],
  [],
  [4, "Dr", "Green", "Registrar", "General", "Northgate Regional"],
  [5, "Mr", "Piper", "Biomedical engineer", null, "Northgate Regional   "],
  [6, "Dr", "Swelha", "Consultant", "Colorectal", "Northgate Regional"],
  [],
  ["Total attendees: 6"],
];

/** Merged ranges, as Excel records them. The parser ignores these; that is the point. */
const MERGES = ["A1:F1", "B3:C3"];

const escapeXml = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const columnLetter = (index) => {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
};

function sheetXml() {
  const rows = ROWS.map((cells, r) => {
    const cellXml = cells
      .map((value, c) => {
        if (value === null || value === undefined) return "";
        const ref = `${columnLetter(c)}${r + 1}`;
        if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
      })
      .join("");
    return `<row r="${r + 1}">${cellXml}</row>`;
  });
  const merges = MERGES.map((ref) => `<mergeCell ref="${ref}"/>`).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rows.join("")}</sheetData>` +
    `<mergeCells count="${MERGES.length}">${merges}</mergeCells>` +
    `</worksheet>`
  );
}

const PARTS = {
  "[Content_Types].xml":
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`,
  "_rels/.rels":
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`,
  "xl/workbook.xml":
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Sign-in" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`,
  "xl/_rels/workbook.xml.rels":
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`,
  "xl/worksheets/sheet1.xml": sheetXml(),
};

// --- A stored-method ZIP writer ---------------------------------------------------------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n) {
  return [n & 0xff, (n >>> 8) & 0xff];
}
function u32(n) {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(text, "utf8");
    const crc = crc32(data);
    const header = Buffer.from([
      0x50,
      0x4b,
      0x03,
      0x04,
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(nameBytes.length),
      ...u16(0),
    ]);
    local.push(header, nameBytes, data);
    central.push(
      Buffer.from([
        0x50,
        0x4b,
        0x01,
        0x02,
        ...u16(20),
        ...u16(20),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(crc),
        ...u32(data.length),
        ...u32(data.length),
        ...u16(nameBytes.length),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
      ]),
      nameBytes,
    );
    offset += header.length + nameBytes.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.from([
    0x50,
    0x4b,
    0x05,
    0x06,
    ...u16(0),
    ...u16(0),
    ...u16(central.length / 2),
    ...u16(central.length / 2),
    ...u32(centralBytes.length),
    ...u32(offset),
    ...u16(0),
  ]);
  return Buffer.concat([...local, centralBytes, end]);
}

// --- Outputs ---------------------------------------------------------------------------

writeFileSync(join(OUT, "roster-messy.xlsx"), zip(PARTS));

writeFileSync(
  join(OUT, "roster.csv"),
  "﻿" +
    [
      "Name,Job title,Specialty,Organisation",
      '"Okonjo-Baptiste, Dr Amara",Consultant,Colorectal,Northgate Regional',
      "Dr Peter Vance,Consultant,Upper GI,Northgate Regional",
      "Marisol Vance,Theatre coordinator,,Northgate Regional",
      "Tomas Piper,Biomedical engineer,,Northgate Regional",
    ].join("\r\n") +
    "\r\n",
);

writeFileSync(
  join(OUT, "roster-legacy.xls"),
  Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(504),
  ]),
);

console.log("wrote roster-messy.xlsx, roster.csv, roster-legacy.xls to tests/fixtures/");
