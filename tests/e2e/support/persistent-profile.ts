/**
 * Helpers for simulating a browser that died rather than one that was closed.
 *
 * Extracted from `persistence.spec.ts` in session 3, unchanged, because the offline spec
 * needs the same machinery and a second copy would drift from the first.
 *
 * The reasoning behind the approach is worth keeping, because the obvious alternatives
 * quietly test the wrong thing:
 *
 *   - `page.close()` fires `visibilitychange` and `pagehide`, so the app closes its
 *     session marker properly. That is a clean close, which is a different case.
 *   - CDP `Target.closeTarget` also fires `visibilitychange`, for the same reason. It
 *     looks abrupt from the outside but the app still runs its shutdown path.
 *   - CDP `Page.crash` is a genuine renderer death and skips both, but it takes the whole
 *     browser context down with it, so a non-persistent context loses its IndexedDB and
 *     there is nothing left to reopen.
 *
 * So the crash cases run against a persistent profile on disk: crash the renderer, let the
 * context die, relaunch a fresh browser on the same profile directory. That is as close to
 * "the tab died and you reopened the app" as this harness can get, and the storage
 * genuinely round-trips through disk.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium, type BrowserContext, type Page } from "@playwright/test";

export function makeProfile(): string {
  return mkdtempSync(join(tmpdir(), "fieldnote-e2e-"));
}

export function removeProfile(profile: string): void {
  rmSync(profile, { recursive: true, force: true });
}

/**
 * Chromium leaves singleton lock files behind when a profile's browser does not exit
 * cleanly. Removing them lets the next launch reuse the profile instead of hanging.
 */
export function clearProfileLocks(profile: string): void {
  for (const name of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    rmSync(join(profile, name), { force: true });
  }
}

export async function openProfile(profile: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(profile, {});
}

export async function firstPage(context: BrowserContext): Promise<Page> {
  return context.pages()[0] ?? (await context.newPage());
}

/**
 * Kills the renderer outright. No visibilitychange, no pagehide, no shutdown path.
 *
 * `Page.crash` is deliberately not awaited: the target dies before it can reply, and the
 * promise sits unresolved for a minute before rejecting. The page's own `crash` event is
 * the signal that the renderer is actually gone, and it arrives in milliseconds.
 */
export async function crashRenderer(context: BrowserContext, page: Page): Promise<void> {
  const crashed = page.waitForEvent("crash", { timeout: 10_000 }).catch(() => {});
  const cdp = await context.newCDPSession(page);
  void cdp.send("Page.crash").catch(() => {});
  await crashed;
}
