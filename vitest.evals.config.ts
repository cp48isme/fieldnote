/**
 * The eval suite's own vitest config. Separate from `vitest.config.ts` so that
 * `pnpm test` never reaches the live model and `pnpm evals` runs nothing else.
 *
 * Vitest is the runner's host rather than `tsx` or a plain `.mjs`: the corpus and the
 * runner import the pipeline through the `@/` alias, which Node cannot resolve and
 * `tsx` would need a dependency to; vitest already resolves it, already runs TypeScript
 * under the strict config, and reports one line per case. No new dependency.
 *
 * One file, sequential: the cases are live calls and a rate limit would read as a
 * failure. The timeout is per case, generous for the retry on truncation.
 */

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/evals/**/*.test.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 240_000,
    hookTimeout: 60_000,
    retry: 0,
  },
});
