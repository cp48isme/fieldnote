/**
 * Migration v5, run against the fake database: audit records written before the
 * library existed gain an empty passage list and a null library version, and keep
 * everything else.
 */

import type { Transaction } from "dexie";
import { describe, expect, it } from "vitest";

import { MIGRATIONS, type AuditRecordRecord } from "@/lib/db";

import { FakeDatabase } from "./support/fake-database";

type V4Audit = Omit<AuditRecordRecord, "passagesUsed" | "libraryVersion">;

const v4: V4Audit = {
  id: "rec-1",
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 4,
  draftId: "draft-1",
  eventId: "event-1",
  model: "claude-opus-5",
  promptTemplateVersion: "1.1.0",
  guardrailRulesetVersion: "1.2.0",
  inputHash: "a".repeat(64),
  outputHash: "b".repeat(64),
  flagsFired: ["claim-bearing"],
  blocked: null,
  reviewedAt: null,
  exportedAt: null,
  humanEdited: null,
  editDistance: null,
};

describe("migration v5", () => {
  it("backfills an empty passage list and a null library version", async () => {
    const migration = MIGRATIONS.find((m) => m.version === 5);
    expect(migration?.upgrade).toBeDefined();
    const db = new FakeDatabase();
    await db.auditRecords.put(v4);
    await migration!.upgrade!(db as unknown as Transaction);
    const row = db.auditRecords.rows.get("rec-1") as unknown as AuditRecordRecord;
    expect(row.passagesUsed).toEqual([]);
    expect(row.libraryVersion).toBeNull();
    expect(row.flagsFired).toEqual(["claim-bearing"]);
    expect(row.schemaVersion).toBe(5);
  });
});
