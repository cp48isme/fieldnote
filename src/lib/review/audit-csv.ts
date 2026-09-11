/**
 * The audit log as a CSV for an auditor. Plan §4.4; EU AI Act Article 12 record-keeping.
 *
 * One row per audit record: what happened, when, under which model and versions, which
 * rules fired, whether the draft was withheld and why, whether a human opened and
 * exported it, and by how much they changed it. No content and no identity: no draft
 * text, no note text, no name, no event name. Ids only — the record is what survives an
 * event's deletion, and the file says so per row rather than in a header a parser would
 * choke on.
 *
 * `eventStatus` is the orphan column. `present` means the event still exists on this
 * device; `deleted` means the record outlived it (ADR-0008). An auditor reading a row
 * whose event id resolves to nothing should read that column, not suspect the file.
 */

import type { AuditRecordRecord, Id } from "@/lib/db";

export const AUDIT_CSV_COLUMNS = [
  "recordId",
  "draftId",
  "eventId",
  "eventStatus",
  "generatedAt",
  "model",
  "promptTemplateVersion",
  "guardrailRulesetVersion",
  "blocked",
  "flagsFired",
  "inputHash",
  "outputHash",
  "reviewedAt",
  "exportedAt",
  "humanEdited",
  "editDistance",
] as const;

/** Rule ids joined inside one cell; none of them contains this character. */
const FLAG_SEPARATOR = "|";

function iso(timestamp: number | null): string {
  return timestamp === null ? "" : new Date(timestamp).toISOString();
}

function cell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  // RFC 4180: quote when the value carries a comma, a quote, or a line break; double
  // the quotes inside. Hashes and ids never need it; the rule is here for completeness.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function auditRecordToRow(
  record: AuditRecordRecord,
  existingEventIds: ReadonlySet<Id>,
): string[] {
  return [
    record.id,
    record.draftId,
    record.eventId,
    existingEventIds.has(record.eventId) ? "present" : "deleted",
    iso(record.createdAt),
    record.model,
    record.promptTemplateVersion,
    record.guardrailRulesetVersion,
    record.blocked ?? "",
    record.flagsFired.join(FLAG_SEPARATOR),
    record.inputHash ?? "",
    record.outputHash ?? "",
    iso(record.reviewedAt),
    iso(record.exportedAt),
    record.humanEdited === null ? "" : String(record.humanEdited),
    record.editDistance === null ? "" : String(record.editDistance),
  ];
}

export function auditLogToCsv(
  records: readonly AuditRecordRecord[],
  existingEventIds: ReadonlySet<Id>,
): string {
  const lines = [
    AUDIT_CSV_COLUMNS.join(","),
    ...records.map((record) =>
      auditRecordToRow(record, existingEventIds).map(cell).join(","),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
