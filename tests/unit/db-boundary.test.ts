/**
 * Enforces ADR-0004's one load-bearing rule: no module outside the data-access layer
 * imports Dexie.
 *
 * This is the rule that makes session 19's encryption work a hook swap rather than a
 * rewrite, so it is asserted rather than trusted. Written as a test rather than a lint
 * rule because it needs no new dependency and issue #11 has the ESLint config pinned to
 * a flat-config migration that has not happened yet.
 *
 * To confirm it actually fails: add `import Dexie from "dexie";` to any file under
 * `src/` outside `src/lib/db/` and run `pnpm test`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

/** The data-access layer. Only these files may reach Dexie. */
const ALLOWED_DIR = join("src", "lib", "db");

/** Matches `from "dexie"`, `from "dexie-react-hooks"`, `require("dexie")`, `import("dexie")`. */
const DEXIE_IMPORT =
  /(?:from\s*|require\(\s*|import\(\s*)["'`]dexie(?:-react-hooks)?["'`]/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("data-access layer boundary", () => {
  const files = walk(SRC);

  it("finds source files to check", () => {
    // Guards against the walk silently returning nothing, which would make the
    // assertion below vacuously true.
    expect(files.length).toBeGreaterThan(0);
  });

  it("confirms the allowed directory really does import Dexie", () => {
    // If this fails, the pattern has drifted and the check below proves nothing.
    const inLayer = files.filter((f) =>
      relative(process.cwd(), f).startsWith(ALLOWED_DIR),
    );
    const importers = inLayer.filter((f) => DEXIE_IMPORT.test(readFileSync(f, "utf8")));
    expect(importers.length).toBeGreaterThan(0);
  });

  it("has no Dexie import outside src/lib/db", () => {
    const offenders = files
      .map((f) => relative(process.cwd(), f))
      .filter((f) => !f.startsWith(ALLOWED_DIR))
      .filter((f) => DEXIE_IMPORT.test(readFileSync(join(process.cwd(), f), "utf8")))
      // Normalise separators so the failure message is readable on any platform.
      .map((f) => f.split(sep).join("/"));

    expect(offenders).toEqual([]);
  });
});
