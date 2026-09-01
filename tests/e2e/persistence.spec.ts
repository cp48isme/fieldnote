import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * The session 2 done-check: create an event, lose the tab mid-typing, reopen, and find
 * everything including the half-finished note.
 *
 * Simulating an unclean shutdown took three attempts, and the reasoning is worth
 * recording because the obvious approaches quietly test the wrong thing.
 *
 *   - `page.close()` fires `visibilitychange` and `pagehide`, so the app closes its
 *     session marker properly. That tests a clean close, which is a different case —
 *     covered separately below.
 *   - CDP `Target.closeTarget` also fires `visibilitychange`, for the same reason. It
 *     looks abrupt from the outside but the app still runs its shutdown path.
 *   - CDP `Page.crash` is a genuine renderer death and skips both, but it takes the
 *     whole browser context down with it, so a non-persistent context loses its
 *     IndexedDB and there is nothing left to reopen.
 *
 * So the crash cases run against a persistent profile on disk: crash the renderer, let
 * the context die, relaunch a fresh browser on the same profile directory. That is as
 * close to "the tab died and you reopened the app" as this harness can get, and the
 * storage genuinely round-trips through disk rather than living in a context that was
 * politely torn down.
 *
 * Chromium-only, matching the single project in playwright.config.ts.
 *
 * All fixture data is synthetic, per ADR-0001: an invented site, an invented question.
 */

/** Matches PORT in playwright.config.ts, whose webServer serves these tests. */
const BASE_URL = "http://127.0.0.1:3000";

const SITE = "Northgate demonstration day";

/** Typed, autosaved, and confirmed on disk before the kill. */
const SAVED_CHUNK =
  "Asked whether the cabinet clears a standard theatre door on the way in.";

/** Typed after that, with no pause — in flight when the renderer dies. */
const IN_FLIGHT_SUFFIX = " Follow up with the meas";

async function firstPage(context: BrowserContext): Promise<Page> {
  return context.pages()[0] ?? (await context.newPage());
}

async function createEventWithNote(page: Page, text: string): Promise<void> {
  await page.goto(`${BASE_URL}/`);
  await page.getByTestId("event-name").fill(SITE);
  await page.getByTestId("create-event").click();
  await expect(page.getByTestId("note-body")).toBeVisible();
  await page.getByTestId("note-body").fill(text);
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
}

/**
 * Kills the renderer outright. No visibilitychange, no pagehide, no shutdown path.
 *
 * `Page.crash` is deliberately not awaited: the target dies before it can reply, and the
 * promise sits unresolved for a minute before rejecting. The page's own `crash` event is
 * the signal that the renderer is actually gone, and it arrives in milliseconds.
 */
async function crashRenderer(context: BrowserContext, page: Page): Promise<void> {
  const crashed = page.waitForEvent("crash", { timeout: 10_000 }).catch(() => {});
  const cdp = await context.newCDPSession(page);
  void cdp.send("Page.crash").catch(() => {});
  await crashed;
}

/**
 * Chromium leaves singleton lock files behind when a profile's browser does not exit
 * cleanly. Removing them lets the next launch reuse the profile instead of hanging.
 */
function clearProfileLocks(profile: string): void {
  for (const name of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    rmSync(join(profile, name), { force: true });
  }
}

test.describe("persistence and crash recovery", () => {
  test("a half-finished note survives a renderer crash", async () => {
    const profile = mkdtempSync(join(tmpdir(), "fieldnote-e2e-"));
    try {
      const first = await chromium.launchPersistentContext(profile, {});
      const page = await firstPage(first);

      await createEventWithNote(page, SAVED_CHUNK);

      // Keep typing. This is the mid-keystroke state: scheduled, not yet written.
      await page.getByTestId("note-body").fill(SAVED_CHUNK + IN_FLIGHT_SUFFIX);
      await expect(page.getByTestId("save-state")).toHaveAttribute(
        "data-state",
        "pending",
      );

      await crashRenderer(first, page);
      await first.close().catch(() => {});
      clearProfileLocks(profile);

      // Reopen the app against the same on-disk profile.
      const second = await chromium.launchPersistentContext(profile, {});
      const reopened = await firstPage(second);
      await reopened.goto(`${BASE_URL}/`);

      // The event and the confirmed text are both back. The in-flight suffix may or may
      // not have landed — asserting on the prefix is the guarantee autosave actually
      // makes, and asserting more would be asserting a race.
      await expect(reopened.getByTestId("event-name-display")).toHaveText(SITE);
      await expect(reopened.getByTestId("note-body")).toHaveValue(
        new RegExp(`^${SAVED_CHUNK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      );

      // Recovery is explicit, not silent.
      await expect(reopened.getByTestId("recovered-session")).toBeVisible();

      await second.close();
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  });

  test("dismissing recovery clears it for the next load", async () => {
    const profile = mkdtempSync(join(tmpdir(), "fieldnote-e2e-"));
    try {
      const first = await chromium.launchPersistentContext(profile, {});
      const page = await firstPage(first);
      await createEventWithNote(page, SAVED_CHUNK);
      await crashRenderer(first, page);
      await first.close().catch(() => {});
      clearProfileLocks(profile);

      const second = await chromium.launchPersistentContext(profile, {});
      const afterCrash = await firstPage(second);
      await afterCrash.goto(`${BASE_URL}/`);
      await expect(afterCrash.getByTestId("recovered-session")).toBeVisible();
      await afterCrash.getByTestId("dismiss-recovery").click();
      await expect(afterCrash.getByTestId("recovered-session")).toBeHidden();
      // Close the page, not just the context: closing a persistent context does not
      // reliably run the page's shutdown path, which would leak an open marker and make
      // the assertion below fail for a reason unrelated to what it is testing.
      await afterCrash.close();
      await second.close();
      clearProfileLocks(profile);

      // The notice does not come back — the user has been told once.
      const third = await chromium.launchPersistentContext(profile, {});
      const later = await firstPage(third);
      await later.goto(`${BASE_URL}/`);
      await expect(later.getByTestId("note-body")).toHaveValue(SAVED_CHUNK);
      await expect(later.getByTestId("recovered-session")).toBeHidden();
      await third.close();
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  });

  test("a clean shutdown does not report a recovered session", async ({ browser }) => {
    // Without this, the banner could be permanently on and the crash tests above would
    // still pass. This is what makes the recovery signal mean something — and it caught
    // a real bug: an earlier `endSession` did a read-then-write and lost the race
    // against teardown, reporting clean closes as crashes.
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/");
    await page.getByTestId("event-name").fill(SITE);
    await page.getByTestId("create-event").click();
    await expect(page.getByTestId("note-body")).toBeVisible();
    await page.getByTestId("note-body").fill(SAVED_CHUNK);
    await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

    // Close politely: the shutdown path runs and the session marker is closed.
    await page.close();

    const reopened = await context.newPage();
    await reopened.goto("/");

    await expect(reopened.getByTestId("note-body")).toHaveValue(SAVED_CHUNK);
    await expect(reopened.getByTestId("recovered-session")).toBeHidden();

    await context.close();
  });
});
