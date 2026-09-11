/**
 * An in-memory stand-in for the Dexie instance, covering exactly the surface
 * `repository.ts` uses: `put`, `get`, `toArray`, `bulkDelete`, `where(field).equals(v)`
 * with `toArray` and `delete`, `orderBy(field)` with `reverse` and `toArray`, and
 * `transaction(mode, ...tables, scope)` with rollback when the scope throws.
 *
 * Why a fake and not `fake-indexeddb`: the same reasoning as `session-lifecycle.test.ts`.
 * jsdom has no IndexedDB, this repository has no fake-indexeddb dependency, and a
 * dependency bought to test bookkeeping is a dependency. The storage path itself runs
 * against a real browser in `tests/e2e/review.spec.ts`; what is under test here is the
 * repository's logic — transitions, invariants, what a cascade spares — which is where
 * the adversarial cases live.
 *
 * What the fake gets right that matters: a `put` inside a transaction is undone if the
 * scope throws, and a table can be made to throw on its next write. What it does not
 * model: concurrency, index semantics beyond equality, or Dexie's own promise rules.
 * A test that would depend on any of those belongs in the e2e suite.
 */

import type { FieldnoteDatabase } from "@/lib/db/database";

interface Row {
  id: string;
}

export class FakeTable<T extends Row> {
  readonly rows = new Map<string, T>();
  /** Set to make the next write throw, for the invariant tests. Cleared after it fires. */
  failNextWrite: Error | null = null;

  private write(): void {
    if (this.failNextWrite) {
      const error = this.failNextWrite;
      this.failNextWrite = null;
      throw error;
    }
  }

  async put(row: T): Promise<string> {
    this.write();
    this.rows.set(row.id, structuredClone(row));
    return row.id;
  }

  async get(id: string): Promise<T | undefined> {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : undefined;
  }

  async toArray(): Promise<T[]> {
    return [...this.rows.values()].map((row) => structuredClone(row));
  }

  async bulkDelete(ids: string[]): Promise<void> {
    this.write();
    for (const id of ids) this.rows.delete(id);
  }

  async delete(id: string): Promise<void> {
    this.write();
    this.rows.delete(id);
  }

  where(field: keyof T & string) {
    return {
      equals: (value: unknown) => {
        const matching = () =>
          [...this.rows.values()].filter((row) => row[field] === value);
        return {
          toArray: async () => matching().map((row) => structuredClone(row)),
          delete: async () => {
            this.write();
            const hits = matching();
            for (const row of hits) this.rows.delete(row.id);
            return hits.length;
          },
        };
      },
    };
  }

  orderBy(field: keyof T & string) {
    const sorted = () =>
      [...this.rows.values()].sort((a, b) => {
        const left = a[field] as unknown as number;
        const right = b[field] as unknown as number;
        return left - right;
      });
    return {
      toArray: async () => sorted().map((row) => structuredClone(row)),
      reverse: () => ({
        toArray: async () =>
          sorted()
            .reverse()
            .map((row) => structuredClone(row)),
      }),
    };
  }

  snapshot(): Map<string, T> {
    return new Map([...this.rows].map(([id, row]) => [id, structuredClone(row)]));
  }

  restore(snapshot: Map<string, T>): void {
    this.rows.clear();
    for (const [id, row] of snapshot) this.rows.set(id, row);
  }
}

export class FakeDatabase {
  readonly events = new FakeTable<Row>();
  readonly attendees = new FakeTable<Row>();
  readonly notes = new FakeTable<Row>();
  readonly drafts = new FakeTable<Row>();
  readonly auditRecords = new FakeTable<Row>();
  readonly voiceProfiles = new FakeTable<Row>();
  readonly approvedContent = new FakeTable<Row>();
  readonly settings = new FakeTable<Row>();
  readonly sessionMarkers = new FakeTable<Row>();

  /** Dexie's signature: mode, the tables in scope, then the scope function last. */
  async transaction<R>(
    _mode: string,
    ...rest: [...FakeTable<Row>[], () => Promise<R>]
  ): Promise<R> {
    const scope = rest[rest.length - 1] as () => Promise<R>;
    const tables = rest.slice(0, -1) as FakeTable<Row>[];
    const snapshots = tables.map((table) => table.snapshot());
    try {
      return await scope();
    } catch (cause) {
      tables.forEach((table, i) => table.restore(snapshots[i]!));
      throw cause;
    }
  }

  /**
   * The repository is typed against the Dexie class. The fake covers the members it
   * uses; the assertion is the one place that is stated.
   */
  asDatabase(): FieldnoteDatabase {
    return this as unknown as FieldnoteDatabase;
  }
}
