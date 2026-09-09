import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // In CI the Verify job has just built, so building again would cost a minute and
    // prove nothing; the End-to-end step runs after Build for exactly this reason.
    // Locally the build is part of the command so `pnpm test:e2e` is one thing to run.
    //
    // `reuseExistingServer` is off in CI and on locally. Locally it means a server left
    // listening on the port from an earlier run is what the suite tests — once, a
    // day-old one turned the whole suite red against a build that predated the branch.
    // `lsof -iTCP:3000` before trusting a local result.
    command: process.env.CI
      ? `pnpm start --port ${PORT}`
      : `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
