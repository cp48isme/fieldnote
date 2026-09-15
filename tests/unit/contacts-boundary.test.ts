/**
 * A contact never enters a model call and the pseudonymizer never sees one.
 *
 * The schema says so (`ContactRecord`); this is what enforces it. Nothing under
 * `src/lib/generation/` or `src/lib/privacy/` may name the contacts table, its record
 * type, or its repository functions. The pipeline takes attendees and nothing else, and
 * that is asserted on its input type by construction here too: a `BatchInput` with a
 * `contacts` key is a type error, checked by the `satisfies` below.
 *
 * Same shape as `db-boundary.test.ts`, for the same reason: a test needs no new
 * dependency and fails the build.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import type { BatchInput } from "@/lib/generation/pipeline";

const FORBIDDEN_DIRS = [join("src", "lib", "generation"), join("src", "lib", "privacy")];

/** The names a module would have to use to reach contacts. */
const CONTACT_REFERENCE =
  /\bContactRecord\b|\bContactInput\b|\b(?:create|list|update|remove)Contacts?\b|TABLES\.contacts\b|["'`]contacts["'`]/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("contacts stay out of the generation layer", () => {
  it("confirms the pattern matches the repository's own contact code", () => {
    // If this fails the pattern has drifted and the check below proves nothing.
    const repository = readFileSync(
      join(process.cwd(), "src/lib/db/repository.ts"),
      "utf8",
    );
    expect(CONTACT_REFERENCE.test(repository)).toBe(true);
  });

  it("finds no reference to contacts under src/lib/generation or src/lib/privacy", () => {
    const offenders = FORBIDDEN_DIRS.flatMap((dir) => walk(join(process.cwd(), dir)))
      .filter((file) => CONTACT_REFERENCE.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file).split(sep).join("/"));
    expect(offenders).toEqual([]);
  });

  it("gives the pipeline no way to receive contacts", () => {
    // `satisfies` fails to compile if BatchInput ever gains a `contacts` key; the
    // runtime assertion is the same fact stated where a test reporter can see it.
    const keys = {
      event: true,
      attendees: true,
      notes: true,
      library: true,
      requestDraft: true,
    } satisfies Record<keyof BatchInput, true>;
    expect(Object.keys(keys)).not.toContain("contacts");
  });
});
