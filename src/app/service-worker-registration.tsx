"use client";

/**
 * Registers the offline shell's service worker.
 *
 * Production only. In `next dev` the asset URLs change on every recompile, so a
 * cache-first worker serves chunks that no longer match the page and hot reload stops
 * working — and `public/precache.json` is a build artifact that does not exist there
 * anyway. The offline behaviour is therefore exercised against `pnpm build && pnpm
 * start`, which is what `tests/e2e/offline.spec.ts` and the manual check both use.
 *
 * A failed registration is logged and nothing else. It is not an error the user can act
 * on mid-event, and per CLAUDE.md there is no error reporting service to send it to.
 */

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((cause: unknown) => {
      console.warn(
        "Service worker registration failed; the app will not work offline.",
        cause,
      );
    });
  }, []);

  return null;
}
