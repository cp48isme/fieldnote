import { expect, test } from "@playwright/test";

/**
 * One palette, light, always.
 *
 * The app followed the operating system's dark-mode setting, and on the device on
 * 2026-09-22 that made the capture surface hard to read outdoors. The dark variant is
 * removed rather than overridden, so the check that matters is what a device *set to
 * dark* renders: if a `prefers-color-scheme: dark` rule survived anywhere, this fails.
 */

const CREAM = "rgb(250, 246, 238)";
const INK = "rgb(26, 23, 18)";

test.describe("the palette does not follow the device", () => {
  test.use({ colorScheme: "dark" });

  test("a device set to dark still renders cream with dark text", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    await expect(body).toHaveCSS("background-color", CREAM);
    await expect(body).toHaveCSS("color", INK);

    // The capture surface itself, not just the body behind it.
    await expect(page.getByTestId("event-name")).toBeVisible();
    const heading = page.getByRole("heading", { name: "Fieldnote" });
    await expect(heading).toHaveCSS("color", INK);
  });

  test("color-scheme is light, so form controls do not render dark", async ({ page }) => {
    await page.goto("/");
    const scheme = await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    );
    expect(scheme).toBe("light");
  });

  test("the settings screen is cream too", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("body")).toHaveCSS("background-color", CREAM);
    await expect(page.getByTestId("access-key-input")).toBeVisible();
  });

  test("the manifest's colours match the page", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.background_color).toBe("#faf6ee");
    expect(manifest.theme_color).toBe("#faf6ee");
  });
});
