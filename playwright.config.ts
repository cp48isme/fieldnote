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
    // The caller key's hash, so `tests/e2e/access-key.spec.ts` can post the matching key
    // to the real route and watch the real cookie come back (ADR-0012). Synthetic, and
    // obviously so: it is the SHA-256 of E2E_ACCESS_KEY in that spec. Merged over
    // `process.env` by Playwright, so the rest of the environment is untouched — and
    // `ANTHROPIC_API_KEY` stays absent on CI, which is why no test here reaches a model.
    env: {
      FIELDNOTE_ACCESS_KEY_HASHES:
        "f8bc042e1fb04094da38cd383f0475f02c12539d0e8db439b8b5cc8252ef9368",
    },
  },
});
