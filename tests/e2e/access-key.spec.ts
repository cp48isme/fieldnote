import { expect, test, type Page } from "@playwright/test";

/**
 * The caller key, end to end, in a real browser against the real route. ADR-0012.
 *
 * What only a browser can answer: that a plain form post sets the cookie, that the cookie
 * is `HttpOnly` so `document.cookie` cannot see it, and that the app still drafts with it
 * in place. The key here is synthetic and its hash is in `playwright.config.ts`, which is
 * how the server under test is configured to accept it; nothing in this file reaches a
 * model, because the generation route is mocked exactly as `review.spec.ts` mocks it.
 *
 * All fixture data is synthetic, per ADR-0001.
 */

const ACCESS_KEY = "fieldnote-e2e-not-a-real-key";
const SITE = "Carrowmore mobile unit, bay 1";
const ATTENDEE = "Dr. Okonjo-Baptiste";
const NOTE = "Asked how long the mount takes to set up single-handed.";

async function enterKey(page: Page, key: string): Promise<void> {
  await page.goto("/settings");
  await page.getByTestId("access-key-input").fill(key);
  await page.getByTestId("access-save").click();
}

async function accessCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === "fieldnote_access");
}

test.describe("the caller key", () => {
  test("the settings form sets an HttpOnly cookie the page cannot read", async ({
    page,
  }) => {
    await enterKey(page, ACCESS_KEY);

    // The 303 lands back on the app, not on the settings screen.
    await expect(
      page.getByTestId("capture-dock").or(page.getByTestId("event-name")),
    ).toBeVisible();

    const cookie = await accessCookie(page);
    expect(cookie, "the cookie was set").toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.secure).toBe(true);
    expect(cookie!.sameSite).toBe("Strict");
    expect(cookie!.path).toBe("/api");
    expect(cookie!.value).toBe(ACCESS_KEY);

    // The whole point: no script on the page can read it, so nothing can copy it out.
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain(ACCESS_KEY);
    expect(visible).not.toContain("fieldnote_access");
  });

  test("a wrong key sets nothing and says so", async ({ page }) => {
    await enterKey(page, "not-the-key");
    await expect(page.getByTestId("access-failed")).toBeVisible();
    expect(await accessCookie(page)).toBeUndefined();
  });

  test("forget this device removes the cookie", async ({ page }) => {
    await enterKey(page, ACCESS_KEY);
    expect(await accessCookie(page)).toBeDefined();

    await page.goto("/settings");
    await page.getByTestId("access-forget").click();
    await expect(
      page.getByTestId("event-name").or(page.getByTestId("capture-dock")),
    ).toBeVisible();

    expect(await accessCookie(page)).toBeUndefined();
  });

  test("with the key entered, drafting still works", async ({ page }) => {
    // The route is mocked, as in `review.spec.ts`: what is under test is that adding the
    // cookie to the picture changes nothing the representative sees.
    await page.route("**/api/generate", async (route) => {
      const request = route.request().postDataJSON() as { recipientToken: string };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: `Subject: Thank you\n\nDear ${request.recipientToken},\n\nThank you for your time.\n\nKind regards,`,
          blocked: null,
          model: "claude-opus-5",
          promptTemplateVersion: "1.0.0",
          flagsFired: [],
        }),
      });
    });

    await enterKey(page, ACCESS_KEY);

    await page.goto("/");
    await page.getByTestId("event-name").fill(SITE);
    await page.getByTestId("create-event").click();
    await expect(page.getByTestId("capture-dock")).toBeVisible();
    await page.getByTestId("note-body").fill(NOTE);
    await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
    await page.getByTestId("toggle-add-attendee").click();
    await page.getByTestId("new-attendee-name").fill(ATTENDEE);
    await page.getByTestId("save-attendee").click();
    await expect(page.getByTestId("note-attendee")).not.toHaveValue("");

    // The generate button lives in the review view.
    await page.getByTestId("toggle-view").click();
    await expect(page.getByTestId("follow-ups-empty")).toBeVisible();
    await page.getByTestId("draft-follow-ups").click();
    await expect(page.getByTestId("draft-row")).toHaveCount(1);
  });
});
