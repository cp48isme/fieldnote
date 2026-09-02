#!/usr/bin/env node
/**
 * Writes the service worker's precache manifest.
 *
 * Runs after `next build`, as part of `pnpm build`. The service worker itself is
 * hand-written and committed at `public/sw.js`; the only thing that cannot be written by
 * hand is this list, because Next content-hashes asset filenames and they change on
 * every build.
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

  process.stdout.write(
    `build-service-worker: ${urls.length} URLs precached for build ${buildId}\n`,
  );
}

main();
