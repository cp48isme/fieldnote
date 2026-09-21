/**
 * Where the private term list comes from: the file, the environment, or neither.
 *
 * The terms here are synthetic and obviously so, as `private-terms.test.ts` says of its
 * own: what is under test is the resolution, not the real list, which is untestable in
 * public by construction (ADR-0001).
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PRIVATE_TERMS_VARIABLE, resolvePrivateTerms } from "@/lib/private-terms-source";

const FILE_TERM = "Quillfeather";
const ENV_TERM = "Marigold Mk II";

let directory: string;
let filePath: string;
/** A path that does not exist, which is every public clone and every CI runner. */
let missingPath: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "fieldnote-terms-"));
  filePath = join(directory, "terms.local");
  missingPath = join(directory, "absent.local");
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("resolvePrivateTerms", () => {
  it("reads the environment variable when there is no file", () => {
    const resolved = resolvePrivateTerms(missingPath, `${ENV_TERM}\nSecond term`);
    expect(resolved.status).toBe("loaded");
    expect(resolved.source).toBe("environment");
    expect(resolved.count).toBe(2);
    expect(resolved.rule.violates(`We fitted the ${ENV_TERM} last week.`)).toBe(true);
    expect(resolved.rule.violates("We fitted the cart last week.")).toBe(false);
  });

  it("reads the file when there is one", () => {
    writeFileSync(filePath, `${FILE_TERM}\n`, "utf8");
    const resolved = resolvePrivateTerms(filePath, undefined);
    expect(resolved.status).toBe("loaded");
    expect(resolved.source).toBe("file");
    expect(resolved.count).toBe(1);
    expect(resolved.rule.violates(`The ${FILE_TERM} console is ready.`)).toBe(true);
  });

  it("lets the file win when both are set", () => {
    // A machine with a local list behaves exactly as it did before this existed, and a
    // stale variable cannot override the file someone is editing in front of them.
    writeFileSync(filePath, `${FILE_TERM}\n`, "utf8");
    const resolved = resolvePrivateTerms(filePath, ENV_TERM);
    expect(resolved.source).toBe("file");
    expect(resolved.count).toBe(1);
    expect(resolved.rule.violates(`The ${FILE_TERM} console is ready.`)).toBe(true);
    expect(resolved.rule.violates(`The ${ENV_TERM} is ready.`)).toBe(false);
  });

  it("is inert, and says so, when neither is set", () => {
    const resolved = resolvePrivateTerms(missingPath, undefined);
    expect(resolved.status).toBe("absent");
    expect(resolved.source).toBe("none");
    expect(resolved.count).toBe(0);
    expect(resolved.rule.violates("anything at all")).toBe(false);
  });

  it("treats a variable of only blank lines and comments as absent, not as zero terms", () => {
    const resolved = resolvePrivateTerms(missingPath, "\n  \n# a comment\n");
    expect(resolved.status).toBe("absent");
    expect(resolved.source).toBe("none");
    expect(resolved.count).toBe(0);
  });

  it("parses the variable the way the file is parsed: comments and blanks ignored", () => {
    const resolved = resolvePrivateTerms(
      missingPath,
      `# the list\n${ENV_TERM}\n\n  Second term  \n`,
    );
    expect(resolved.count).toBe(2);
    expect(resolved.rule.violates("a second term appeared")).toBe(true);
  });

  it("names the variable once, so the route and the deployment cannot drift", () => {
    expect(PRIVATE_TERMS_VARIABLE).toBe("FIELDNOTE_GUARDRAIL_TERMS");
  });

  it("returns a status, a count, and a source, and never a term", () => {
    writeFileSync(filePath, `${FILE_TERM}\n`, "utf8");
    const resolved = resolvePrivateTerms(filePath, ENV_TERM);
    // The rule is a function, so the terms are reachable only by testing sentences
    // against it. What a caller can serialise — which is what the route logs — is these.
    expect(Object.keys(resolved).sort()).toEqual(["count", "rule", "source", "status"]);
    expect(JSON.stringify({ ...resolved, rule: undefined })).not.toContain(FILE_TERM);
    expect(JSON.stringify({ ...resolved, rule: undefined })).not.toContain(ENV_TERM);
  });
});
