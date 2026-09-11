/**
 * The audit log CSV: every column, no content, and the orphan column that tells an
 * auditor a record outlived its event rather than that the file is corrupt.
 */

import { describe, expect, it } from "vitest";

import type { AuditRecordRecord } from "@/lib/db";
import { AUDIT_CSV_COLUMNS, auditLogToCsv } from "@/lib/review/audit-csv";

function record(overrides: Partial<AuditRecordRecord> = {}): AuditRecordRecord {
  return {
    id: "rec-1",
    createdAt: Date.UTC(2026, 8, 11, 9, 30),
    updatedAt: Date.UTC(2026, 8, 11, 9, 30),
    schemaVersion: 2,
    draftId: "draft-1",
    eventId: "event-1",
    model: "claude-opus-5",
    promptTemplateVersion: "1.0.0",
    guardrailRulesetVersion: "1.1.0",
    inputHash: "a".repeat(64),
    outputHash: "b".repeat(64),
    flagsFired: ["claim-bearing", "pricing"],
    blocked: null,
    reviewedAt: null,
    exportedAt: null,
    humanEdited: null,
    editDistance: null,
    ...overrides,
  };
}

describe("auditLogToCsv", () => {
  it("writes the header and one row per record, CRLF-terminated", () => {
    const csv = auditLogToCsv([record()], new Set(["event-1"]));
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(AUDIT_CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe("");
  });

  it("carries every field an auditor needs and nothing that names anyone", () => {
    const csv = auditLogToCsv(
      [
        record({
          reviewedAt: Date.UTC(2026, 8, 11, 9, 45),
          exportedAt: Date.UTC(2026, 8, 11, 9, 50),
          humanEdited: true,
          editDistance: 37,
        }),
      ],
      new Set(["event-1"]),
    );
    const row = csv.split("\r\n")[1]!.split(",");
    const at = (column: (typeof AUDIT_CSV_COLUMNS)[number]) =>
      row[AUDIT_CSV_COLUMNS.indexOf(column)];
    expect(at("eventStatus")).toBe("present");
    expect(at("generatedAt")).toBe("2026-09-11T09:30:00.000Z");
    expect(at("flagsFired")).toBe("claim-bearing|pricing");
    expect(at("blocked")).toBe("");
    expect(at("reviewedAt")).toBe("2026-09-11T09:45:00.000Z");
    expect(at("exportedAt")).toBe("2026-09-11T09:50:00.000Z");
    expect(at("humanEdited")).toBe("true");
    expect(at("editDistance")).toBe("37");
    expect(row).toHaveLength(AUDIT_CSV_COLUMNS.length);
  });

  it("marks a record whose event is gone as deleted, and keeps the row", () => {
    const csv = auditLogToCsv(
      [record({ eventId: "event-gone" }), record({ id: "rec-2" })],
      new Set(["event-1"]),
    );
    const rows = csv.trim().split("\r\n").slice(1);
    expect(rows[0]).toContain(",deleted,");
    expect(rows[1]).toContain(",present,");
  });

  it("writes a withheld generation with its reason and empty export fields", () => {
    const csv = auditLogToCsv(
      [record({ blocked: "refusal", outputHash: null, flagsFired: [] })],
      new Set(["event-1"]),
    );
    const row = csv.split("\r\n")[1]!.split(",");
    expect(row[AUDIT_CSV_COLUMNS.indexOf("blocked")]).toBe("refusal");
    expect(row[AUDIT_CSV_COLUMNS.indexOf("outputHash")]).toBe("");
    expect(row[AUDIT_CSV_COLUMNS.indexOf("flagsFired")]).toBe("");
  });

  it("quotes a value carrying a comma, so the column count holds", () => {
    const csv = auditLogToCsv([record({ model: "a,b" })], new Set());
    expect(csv.split("\r\n")[1]).toContain('"a,b"');
  });
});
