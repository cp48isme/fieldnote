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

import { requestPersistentStorage } from "@/lib/storage/persistence";

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

  /**
   * Ask the browser to keep the store, once per load (`fieldnote-bdw`, ADR-0012).
   *
   * In its own effect, not the one above, and outside the production guard: the two are
   * unrelated, and asking is as worth doing in development as anywhere. The answer is
   * deliberately dropped — `navigator.storage` is the record, and the settings screen
   * reads it back. `requestPersistentStorage` never rejects, so nothing here can stop
   * the application starting.
   */
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  return null;
}
