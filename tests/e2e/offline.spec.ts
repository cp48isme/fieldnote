import { expect, test, type Page } from "@playwright/test";

import {
  clearProfileLocks,
  crashRenderer,
  firstPage,
  makeProfile,
  openProfile,
  removeProfile,
} from "./support/persistent-profile";

/**
 * The session 3 done-check: capture works after a hard reload with the network disabled.
 *
 * The distinction the build guide draws is the whole point of this file. Toggling the
 * network off on an already-loaded page proves nothing — the document and every chunk are
 * already in memory, and the page keeps working with no service worker at all. What has to
 * hold is a *reload*: the browser goes back for the document and every asset, and offline
 * they can only come from the cache the worker filled.
 *
 * Two shapes of that are checked. A reload of the page that registered the worker, and a
 * brand-new page navigating to the app for the first time while offline — nothing warm,
 * nothing in memory, the worker serving everything.
 *
 * All fixture data is synthetic, per ADR-0001: an invented site, an invented remark.
 */

/**
 * Matches PORT in playwright.config.ts. Needed explicitly for the persistent-profile test
 * below, because a context launched directly does not inherit the config's `baseURL`.
 */
const BASE_URL = "http://127.0.0.1:3000";

const SITE = "Ridgeway spring clinic day";

const NOTE = "Wanted the trolley height checked against the bench in room two.";

/** A second note, so the log has more than one row to survive the reload. */
const EARLIER_NOTE = "Asked who covers the weekend rota before ordering.";

/**
 * Waits until a worker is not merely registered but activated and in control.
 *
 * `navigator.serviceWorker.ready` resolves at activation; `controller` is what says this
 * page's requests are actually going through it. Without both, the reload below races the
 * worker and fails for a reason that has nothing to do with offline behaviour.
 */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
        once: true,
      });
    });
  });
}

async function captureNote(page: Page, text: string): Promise<void> {
  await page.getByTestId("note-body").fill(text);
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
}

test.describe("offline shell", () => {
  test("capture works after a full reload with the network disabled", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/");
    await waitForServiceWorker(page);

    await page.getByTestId("event-name").fill(SITE);
    await page.getByTestId("create-event").click();
    await captureNote(page, EARLIER_NOTE);
    await page.getByTestId("new-note").click();
    await captureNote(page, NOTE);

    await context.setOffline(true);

    // Prove the network is genuinely gone before claiming anything about offline. `/api/`
    // is excluded from the cache by the worker on purpose, so this request has nowhere to
    // go but the network — and there isn't one.
    await expect
      .poll(() =>
        page.evaluate(() =>
          fetch("/api/offline-probe").then(
            () => "reached the network",
            () => "no network",
          ),
        ),
      )
      .toBe("no network");

    await page.reload({ waitUntil: "load" });

    // The shell rendered from cache...
    await expect(page.getByTestId("capture-dock")).toBeVisible();
    await expect(page.getByTestId("event-name-display")).toHaveText(SITE);
    // ...and the notes came back out of IndexedDB, which never needed a network at all.
    await expect(page.getByTestId("note-body")).toHaveValue(NOTE);
    await expect(page.getByTestId("log-row")).toHaveCount(2);

    // Capture still works while offline: this is the parking lot.
    const OFFLINE_NOTE = "Second visit — bring the shorter cable next time.";
    await page.getByTestId("new-note").click();
    await captureNote(page, OFFLINE_NOTE);
    await expect(page.getByTestId("log-row")).toHaveCount(3);

    // A page that was never loaded online, navigating for the first time with no network.
    const cold = await context.newPage();
    await cold.goto("/");
    await expect(cold.getByTestId("capture-dock")).toBeVisible();
    await expect(cold.getByTestId("note-body")).toHaveValue(OFFLINE_NOTE);

    await context.close();
  });

  test("precaches nothing from a third-party origin", async ({ page }) => {
    // Plan §4.1: the model API route is the only egress. A precached CDN font or script
    // would be a second origin this app depends on, and it would be invisible — the app
    // would keep working offline while the property it claims quietly stopped being true.
    await page.goto("/");
    await waitForServiceWorker(page);

    const cachedUrls = await page.evaluate(async () => {
      const cache = await caches.open("fieldnote-shell");
      return (await cache.keys()).map((request) => request.url);
    });

    expect(cachedUrls.length).toBeGreaterThan(0);
    const origin = new URL(page.url()).origin;
    expect(cachedUrls.filter((url) => !url.startsWith(origin))).toEqual([]);
    // And nothing from the route that does not exist yet.
    expect(cachedUrls.filter((url) => new URL(url).pathname.startsWith("/api/"))).toEqual(
      [],
    );
  });
});

test.describe("session lifecycle across a backgrounded tab", () => {
  test("a crash after the tab returns is still reported", async () => {
    // Bead `fieldnote-5pr`. Backgrounding the tab closes the session marker cleanly; if
    // returning to it did not reopen that marker, the session would stay closed for good
    // and a crash afterwards would report nothing. The user would lose the notice telling
    // them what was in flight, silently.
    //
    // `visibilitychange` is dispatched rather than produced by genuinely backgrounding the
    // tab: a headless browser will not reliably background one, and the alternative —
    // asserting on a tab the harness cannot actually hide — would be a test that passes
    // without exercising anything. What this covers is that the app's listeners are wired
    // to the right calls; the state machine underneath is covered directly in
    // `tests/unit/session-lifecycle.test.ts`.
    const profile = makeProfile();
    try {
      const first = await openProfile(profile);
      const page = await firstPage(first);

      await page.goto(`${BASE_URL}/`);
      await page.getByTestId("event-name").fill(SITE);
      await page.getByTestId("create-event").click();
      await captureNote(page, NOTE);

      await page.evaluate(() => {
        const setVisibility = (state: DocumentVisibilityState) => {
          Object.defineProperty(document, "visibilityState", {
            value: state,
            configurable: true,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        };
        setVisibility("hidden");
        setVisibility("visible");
      });

      // Give the reopening write time to land before killing the renderer.
      await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

      await crashRenderer(first, page);
      await first.close().catch(() => {});
      clearProfileLocks(profile);

      const second = await openProfile(profile);
      const reopened = await firstPage(second);
      await reopened.goto(`${BASE_URL}/`);

      await expect(reopened.getByTestId("recovered-session")).toBeVisible();
      await expect(reopened.getByTestId("note-body")).toHaveValue(NOTE);

      await second.close();
    } finally {
      removeProfile(profile);
    }
  });
});
