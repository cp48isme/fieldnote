import { expect, test } from "@playwright/test";

// Placeholder proving the e2e harness boots the app.
test("app responds", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
});
