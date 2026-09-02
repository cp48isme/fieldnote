import { expect, test, type Page } from "@playwright/test";

/**
 * Environment failures, and the rule that they are visible.
 *
 * Both cases here were found on the first run against a real device over
 * `http://<LAN-IP>:3000`, and both were invisible to the existing suite for the same
 * reason: Playwright runs against `127.0.0.1`, which is a secure context, so an entire
 * class of environment failure could not occur in it.
 *
 * These tests reproduce the *API surface* of an insecure origin rather than the origin
 * itself. There is no Chromium flag to treat an origin as insecure — the flag runs the
 * other way — so the alternatives were the machine's LAN address, which is not portable to
 * CI, or a DNS trick like `nip.io`, which puts a network dependency into the suite. Both
 * substitutions below are exact for the thing under test: `crypto.randomUUID` is genuinely
 * `undefined` there, and `window.isSecureContext` is genuinely `false`.
 *
 * What they do not reproduce is the absent service worker, which is why the insecure-origin
 * case is a gate rather than a degraded mode: the app refuses rather than running without
 * offline capture.
 */

/**
 * The exact failure on a plain-HTTP origin: the API is absent, not merely restricted.
 *
 * Deleted from `Crypto.prototype` rather than from `crypto`, because that is where it
 * lives — removing it from the instance does nothing, which cost one confused test run.
 */
async function withoutRandomUUID(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Crypto.prototype, "randomUUID");
  });
}

async function asInsecureOrigin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      get: () => false,
    });
  });
}

test.describe("insecure origin", () => {
  test("refuses to run, and says what to do about it", async ({ page }) => {
    await asInsecureOrigin(page);
    await page.goto("/");

    await expect(page.getByTestId("insecure-origin")).toBeVisible();
    await expect(page.getByTestId("insecure-origin")).toContainText("needs HTTPS");
    // It names the fix, not just the fault.
    await expect(page.getByTestId("insecure-origin")).toContainText("localhost");

    // The capture surface never mounts, so nothing can be typed into a store that would
    // throw on the first write.
    await expect(page.getByTestId("capture-dock")).toHaveCount(0);
    await expect(page.getByTestId("event-name")).toHaveCount(0);
    await expect(page.getByTestId("loading")).toHaveCount(0);
  });

  test("cannot be dismissed", async ({ page }) => {
    // A state of the environment, not an event. There is nothing to acknowledge, and a
    // notice that can be waved away becomes one that always is.
    await asInsecureOrigin(page);
    await page.goto("/");

    await expect(page.getByTestId("insecure-origin")).toBeVisible();
    await expect(page.getByTestId("insecure-origin").getByRole("button")).toHaveCount(0);
  });

  test("is unreachable on a secure origin", async ({ page }) => {
    // The constraint that makes this notice a signal rather than a warning: if it ever
    // renders on the deployed build, something is broken. Vercel serves HTTPS, so
    // `isSecureContext` is true and this branch cannot be taken.
    await page.goto("/");

    expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
    await expect(page.getByTestId("insecure-origin")).toHaveCount(0);
    await expect(page.getByTestId("event-name")).toBeVisible();
  });
});

test.describe("data layer failure", () => {
  test("degrades to capture without crash recovery, rather than hanging", async ({
    page,
  }) => {
    // This is exactly what happened on the device. `beginSession` writes a session marker,
    // which needs an id, which needs `crypto.randomUUID`. Reads do not, so `listEvents`
    // succeeded while the session never opened — and `ready` gated the whole screen on both.
    await withoutRandomUUID(page);
    await page.goto("/");

    // Reaches a usable state instead of an indefinite "Loading…".
    await expect(page.getByTestId("event-name")).toBeVisible();
    await expect(page.getByTestId("loading")).toHaveCount(0);

    // And says what was lost, rather than implying recovery is armed when it is not.
    await expect(page.getByTestId("recovery-unavailable")).toBeVisible();
    await expect(page.getByTestId("recovery-unavailable")).toContainText(
      "Crash recovery is not armed",
    );
  });

  test("a failing write reaches a terminal state that says what to do", async ({
    page,
  }) => {
    await withoutRandomUUID(page);
    await page.goto("/");

    // Creating an event needs an id, so this is the first write that throws.
    await page.getByTestId("event-name").fill("Northgate demonstration day");
    await page.getByTestId("create-event").click();

    await expect(page.getByTestId("load-failed")).toBeVisible();
    await expect(page.getByTestId("load-failed")).toContainText("could not open");
    await expect(page.getByTestId("load-failed")).toContainText("Reload the page");
    // The underlying error is shown small and last, for whoever is debugging.
    await expect(page.getByTestId("load-failed-detail")).toContainText("randomUUID");
  });

  test("reports no unhandled rejection while failing", async ({ page }) => {
    // The original symptom was a silent hang *plus* an unhandled rejection in the console.
    // Handling the failure means neither.
    const unhandled: string[] = [];
    page.on("pageerror", (error) => unhandled.push(String(error)));

    await withoutRandomUUID(page);
    await page.goto("/");
    await expect(page.getByTestId("event-name")).toBeVisible();

    expect(unhandled).toEqual([]);
  });
});
