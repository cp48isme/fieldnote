/**
 * The single-egress check. Plan §4.1, ADR-0005, build guide session 5.
 *
 * The claim that this system has exactly one network destination — the model API route —
 * is the strongest property in the repository, and until this file it lived only in
 * prose. This makes it a failing build: any network call site in `src/` outside the two
 * allowed files fails `pnpm test`, which runs in CI's `Verify` job.
 *
 * WHAT THIS CATCHES, STATED HONESTLY. This is a grep. It catches the careless case — a
 * transcription service, an analytics SDK, a CDN font added in month four — and not the
 * determined one: a URL assembled from parts, a fetch behind a wrapper with another name,
 * a dependency that phones home from inside `node_modules`, where this never looks. Cite
 * it with that limit attached. Two things sit beside it: `connect-src 'self'` in the
 * security headers (`src/proxy.ts`), which the browser enforces on every request the page
 * makes, and `tests/e2e/offline.spec.ts`, which checks nothing from a third-party origin
 * was precached. Session 15's threat model is scheduled to tighten all three.
 *
 * Verified by adding a `fetch("https://example.invalid")` to a component and watching
 * this fail; the transcript is in the session 5 PR.
 *
 * Same shape as `tests/unit/db-boundary.test.ts`, for the same reason: no new dependency,
 * and the ESLint config is pinned behind issue #11.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { GENERATE_ROUTE } from "@/lib/generation/contract";

const SRC = join(process.cwd(), "src");

/**
 * The two files that may make network calls, and why.
 *
 *   - The API client, whose only destination is the model route on this origin.
 *   - The service worker, which fetches same-origin assets to fill and serve the offline
 *     shell, and returns early for any cross-origin request. Its calls are checked below
 *     for a literal remote URL, which is as far as a grep can see.
 */
const ALLOWED: Record<string, string> = {
  "src/lib/generation/client.ts": "the model route",
  "src/sw/service-worker.js": "same-origin shell assets",
};

/** Every way source in `src/` can open a connection, as the guide lists them. */
const NETWORK_CALL =
  /\bfetch\s*\(|\bXMLHttpRequest\b|new\s+WebSocket\s*\(|navigator\.sendBeacon\b|new\s+EventSource\s*\(|\bimport\s*\(\s*["'`]https?:/;

/** A literal remote URL, which no allowed file may pass to a call. */
const REMOTE_URL = /["'`]https?:\/\//;

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

/** Strips comments, so a `fetch(` in prose about fetching does not count. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const posix = (path: string) => relative(process.cwd(), path).split(sep).join("/");

describe("single egress", () => {
  const files = walk(SRC);

  it("finds source files to check", () => {
    // Guards against the walk silently returning nothing, which would make the assertion
    // below vacuously true.
    expect(files.length).toBeGreaterThan(0);
  });

  it("confirms the allowed files really do make network calls", () => {
    // If this fails, the pattern has drifted and the check below proves nothing.
    for (const allowed of Object.keys(ALLOWED)) {
      const source = codeOnly(readFileSync(join(process.cwd(), allowed), "utf8"));
      expect(NETWORK_CALL.test(source), allowed).toBe(true);
    }
  });

  it("has no network call site outside the allowed files", () => {
    const offenders = files
      .map(posix)
      .filter((f) => !(f in ALLOWED))
      .filter((f) =>
        NETWORK_CALL.test(codeOnly(readFileSync(join(process.cwd(), f), "utf8"))),
      );
    expect(offenders).toEqual([]);
  });

  it("has no literal remote URL passed to a call in the allowed files", () => {
    for (const allowed of Object.keys(ALLOWED)) {
      const source = codeOnly(readFileSync(join(process.cwd(), allowed), "utf8"));
      expect(REMOTE_URL.test(source), allowed).toBe(false);
    }
  });

  it("points the API client at the model route and nothing else", () => {
    const source = codeOnly(
      readFileSync(join(process.cwd(), "src/lib/generation/client.ts"), "utf8"),
    );
    expect(source.match(/\bfetch\s*\(/g)).toHaveLength(1);
    expect(source).toContain("fetch(GENERATE_ROUTE");
    expect(GENERATE_ROUTE.startsWith("/api/")).toBe(true);
  });
});
