/**
 * Fieldnote service worker — the offline shell.
 *
 * This file is the source. `scripts/build-service-worker.mjs` stamps the build id into
 * `BUILD_ID` below and writes the result to `public/sw.js`, which is gitignored. Edit this
 * file, never the generated one.
 *
 * Plan §5 non-negotiable 5: capture works in a parking lot with no signal. The bar is a
 * hard reload with the network disabled, not a network toggle on an already-loaded page,
 * because the second passes with no service worker at all and proves nothing.
 *
 * **Why the build id is stamped in.** A browser only re-installs a worker when the
 * script's bytes change. An earlier version of this file was hand-written, committed, and
 * therefore identical across builds, so `install` ran exactly once per user, ever — the
 * precache was never re-primed and a deploy never reached anyone who had already loaded
 * the app. That was verified by deploying twice and watching the old build keep running,
 * online and offline. Stamping the id is what makes every build a different script, which
 * is what makes the update path exist at all. Do not "simplify" it away.
 *
 * **Coverage of the update path is manual only.** `tests/e2e/offline.spec.ts` covers the
 * offline shell, but nothing automated proves a deploy reaches a user. It is verified by
 * hand — the transcript is in the PR that introduced it, and the procedure is written out
 * in `fieldnote-unp`. Playwright's `webServer` builds once for the whole run, so a
 * two-build test needs a harness this repository does not have. Until that bead lands, a
 * change to the update logic in this file is covered by nothing; re-run the manual
 * procedure rather than trusting a green suite.
 *
 * Two rules this file must not break, from CLAUDE.md and plan §4.1:
 *
 *   - Nothing from a third-party origin is ever cached or fetched. The handler below
 *     returns early for any cross-origin request, so they pass through untouched.
 *   - No API route is cached. Session 5's model route is the system's only egress, and a
 *     cached response to it would be a stale copy of a generation — with content in it —
 *     sitting in a cache this file would then be responsible for. The guard is written
 *     now, before the route exists, because that is the cheap moment to write it.
 */

/**
 * Replaced at build time by `scripts/build-service-worker.mjs`. The generator fails the
 * build if this placeholder is not found, so it cannot silently stop being substituted.
 */
const BUILD_ID = "__FIELDNOTE_BUILD_ID__";

/** One cache per build. Older ones are deleted on activate. */
const CACHE_PREFIX = "fieldnote-shell-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;

/** Written by `scripts/build-service-worker.mjs` as part of `pnpm build`. */
const PRECACHE_URL = "/precache.json";

/** The navigation fallback: what an offline reload of any page is served. */
const SHELL_URL = "/";

/**
 * Populates this build's cache from the generated manifest.
 *
 * `addAll` is all-or-nothing on purpose. A partially populated shell fails later, in the
 * field, on the one reload that mattered; a failed install fails now and is visible in
 * DevTools as a service worker that never reached "activated". It is not, however, visible
 * to the user, which is `fieldnote-gd7`.
 */
async function install() {
  const response = await fetch(PRECACHE_URL, { cache: "reload" });
  if (!response.ok) {
    throw new Error(`precache manifest ${PRECACHE_URL} returned ${response.status}`);
  }
  const manifest = await response.json();

  const cache = await caches.open(CACHE_NAME);
  // `cache: "reload"` bypasses the HTTP cache, so a precache never captures a stale copy
  // of an asset the browser happened to be holding — which matters most immediately after
  // a deploy, when the HTTP cache is exactly where a previous build is still sitting.
  await cache.addAll(manifest.urls.map((url) => new Request(url, { cache: "reload" })));

  await self.skipWaiting();
}

/**
 * Deletes every previous build's cache, then takes over open pages.
 *
 * `skipWaiting` above plus `clients.claim` here means a deploy reaches the user on their
 * next reload rather than waiting for every tab to close. The accepted cost is the usual
 * one: a page still running the previous build, whose cache has just been deleted, will go
 * to the network for any chunk it loads afterwards — fine online, and offline it fails.
 * This app is a single route that loads its code up front, so the window is small, and the
 * alternative — an update that lands only after every tab closes — is worse for a phone
 * that is never closed.
 */
async function activate() {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)),
  );

  await self.clients.claim();
}

/**
 * Navigations: network first, cached shell on failure.
 *
 * `cache: "reload"` on the network attempt is not belt and braces. Without it the browser's
 * own HTTP cache can serve the previous build's HTML long after a deploy, which is a second
 * and entirely separate way for a user to be stuck on an old build — one that survives the
 * worker being updated correctly.
 *
 * The fallback is the cached `/` document for every navigation, not just `/`. There is one
 * route today, and serving the shell is the right answer for a client-rendered app anyway.
 */
async function handleNavigation(request) {
  try {
    return await fetch(new Request(request, { cache: "reload" }));
  } catch (offline) {
    const shell = await caches.match(SHELL_URL);
    if (shell) return shell;
    throw offline;
  }
}

/** Content-hashed build assets. The name changes when the bytes change, so never revalidate. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

/**
 * Everything else same-origin: network, falling back to whatever was precached.
 *
 * Deliberately does not populate the cache. Caching arbitrary responses here would grow
 * the cache without bound and without a rule saying what is in it, and the precache
 * manifest is meant to be the complete answer to "what does offline hold".
 */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (offline) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw offline;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(install());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(activate());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Third-party origins are not this worker's business. Plan §4.1: the model API route is
  // the only egress, and nothing off-origin is cached, precached, or proxied here.
  if (url.origin !== self.location.origin) return;

  // Session 5's model route. Never cached — see the header of this file.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
