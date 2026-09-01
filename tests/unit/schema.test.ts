/**
 * Schema and migration invariants.
 *
 * The completeness of the field classification is enforced by the type system —
 * `FieldPolicies<T>` is a mapped type over `Required<T>`, so an unclassified field is a
 * `pnpm typecheck` failure. These tests cover what types cannot: that the registry and
 * the store declarations agree, and that no encryption-eligible field has been made an
 * index key.
 */

import { describe, expect, it } from "vitest";

import {
  CURRENT_SCHEMA_VERSION,
  LATEST_MIGRATION_VERSION,
  MIGRATIONS,
  POLICIES_BY_TABLE,
  TABLES,
  eligibleFields,
} from "@/lib/db";

const tableNames = Object.values(TABLES);

describe("schema registry", () => {
  it("has a policy set for every table", () => {
    for (const table of tableNames) {
      expect(POLICIES_BY_TABLE[table], `missing policies for ${table}`).toBeDefined();
    }
  });

  it("gives every classified field a reason", () => {
    for (const table of tableNames) {
      for (const [field, policy] of Object.entries(POLICIES_BY_TABLE[table])) {
        expect(
          policy.why.length,
          `${table}.${field} has no stated reason`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("classifies the base fields as clear on every table", () => {
    // Migration machinery and indexes read these before any key could exist.
    for (const table of tableNames) {
      const policies = POLICIES_BY_TABLE[table];
      for (const field of ["id", "createdAt", "updatedAt", "schemaVersion"]) {
        expect(policies[field]?.encryption, `${table}.${field}`).toBe("clear");
      }
    }
  });
});

describe("migrations", () => {
  it("agrees with the stamped schema version", () => {
    expect(LATEST_MIGRATION_VERSION).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("has strictly ascending, unique versions", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("declares a store for every table at the latest version", () => {
    const latest = MIGRATIONS.find((m) => m.version === LATEST_MIGRATION_VERSION);
    expect(latest).toBeDefined();
    for (const table of tableNames) {
      expect(latest?.stores[table], `no store declared for ${table}`).toBeDefined();
    }
  });

  it("never indexes an encryption-eligible field", () => {
    // An index over ciphertext is useless; an index over plaintext would defeat the
    // seam ADR-0004 exists to establish. Either way it must not happen by accident.
    for (const migration of MIGRATIONS) {
      for (const [table, declaration] of Object.entries(migration.stores)) {
        const indexed = declaration
          .split(",")
          .map((part) => part.trim().replace(/^[&*+]+/, ""))
          .filter(Boolean);
        const eligible = eligibleFields(table as keyof typeof POLICIES_BY_TABLE);
        for (const field of indexed) {
          expect(
            eligible,
            `v${migration.version}: ${table}.${field} is indexed but classified encryption-eligible`,
          ).not.toContain(field);
        }
      }
    }
  });
});
