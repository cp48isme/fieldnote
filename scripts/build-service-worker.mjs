#!/usr/bin/env node
/**
 * Writes the service worker and its precache manifest.
 *
 * Runs after `next build`, as part of `pnpm build`. Two outputs, both gitignored:
 *
 *   - `public/sw.js`, from the source at `src/sw/service-worker.js` with the build id
 *     stamped in. The stamp is what makes the worker updatable: a browser only
 *     re-installs when the script's bytes change, so a worker that is identical across
 *     builds installs once per user and pins them to that build forever. That was a real
 *     defect, found by deploying twice; see the header of the source file.
 *   - `public/precache.json`, the URL list, which cannot be written by hand because Next
 *     content-hashes asset filenames and they change on every build.
 *
 * The rule is: precache everything the build emitted under `.next/static`, plus the small
 * fixed set of shell URLs below. Over-precaching is deliberate. A partial list derived
 * from the build manifests would be smaller and would silently omit whatever the
 * derivation missed — and the failure mode of a missing asset is an app that looks fine
 * in the office and fails on a hard reload in a parking lot, which is precisely the
 * failure this is here to prevent. The whole app is a few hundred kilobytes.
 *
 * Nothing here reaches a third-party origin: every URL is a path on this origin.
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const NEXT_DIR = ".next";
const STATIC_DIR = join(NEXT_DIR, "static");
const BUILD_ID_FILE = join(NEXT_DIR, "BUILD_ID");
const OUTPUT_FILE = join("public", "precache.json");

const WORKER_SOURCE_FILE = join("src", "sw", "service-worker.js");
const WORKER_OUTPUT_FILE = join("public", "sw.js");

/** The token in the worker source that carries the build id. */
const BUILD_ID_PLACEHOLDER = "__FIELDNOTE_BUILD_ID__";

/**
 * Shell URLs that are not build assets.
 *
 * `/` is the capture screen's HTML document and is what an offline navigation falls back
 * to. The manifest and icons are here so an installed app opened offline still has them.
 */
const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function fail(message) {
  process.stderr.write(`build-service-worker: ${message}\n`);
  process.exit(1);
}

function main() {
  let buildId;
  try {
    buildId = readFileSync(BUILD_ID_FILE, "utf8").trim();
  } catch {
    fail(`${BUILD_ID_FILE} not found. Run \`next build\` before this script.`);
  }

  let files;
  try {
    files = walk(STATIC_DIR);
  } catch {
    fail(`${STATIC_DIR} not found. Run \`next build\` before this script.`);
  }

  const assetUrls = files
    // `.next/static/<path>` is served at `/_next/static/<path>`.
    .map((file) => `/_next/static/${relative(STATIC_DIR, file).split(sep).join("/")}`)
    .sort();

  if (assetUrls.length === 0) {
    fail(
      `${STATIC_DIR} is empty. The build produced no static assets, which cannot be right.`,
    );
  }

  // Sorted so the file has a stable diff across builds that changed nothing.
  const urls = [...SHELL_URLS, ...assetUrls].sort();

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, `${JSON.stringify({ buildId, urls }, null, 2)}\n`, "utf8");

  writeWorker(buildId);

  process.stdout.write(
    `build-service-worker: ${urls.length} URLs precached for build ${buildId}\n`,
  );
}

/**
 * Stamps the build id into the worker source and writes `public/sw.js`.
 *
 * Fails the build if the placeholder is missing rather than writing a worker that happens
 * to be byte-identical to the last one. That silent case is exactly the defect this
 * function exists to prevent, and it would look like a successful build.
 */
function writeWorker(buildId) {
  let source;
  try {
    source = readFileSync(WORKER_SOURCE_FILE, "utf8");
  } catch {
    fail(`${WORKER_SOURCE_FILE} not found. It is the source for ${WORKER_OUTPUT_FILE}.`);
  }

  if (!source.includes(BUILD_ID_PLACEHOLDER)) {
    fail(
      `${WORKER_SOURCE_FILE} no longer contains ${BUILD_ID_PLACEHOLDER}. Without it every ` +
        `build emits an identical worker, the browser never re-installs it, and users are ` +
        `pinned to whichever build they first loaded. See fieldnote-jug.`,
    );
  }

  writeFileSync(
    WORKER_OUTPUT_FILE,
    source.replaceAll(BUILD_ID_PLACEHOLDER, buildId),
    "utf8",
  );
}

main();
