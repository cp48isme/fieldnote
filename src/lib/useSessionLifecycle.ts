"use client";

/**
 * Owns the capture session's lifecycle: open one on mount, close it cleanly when the tab
 * goes away, reopen it when the tab comes back, and surface any session that died.
 *
 * Extracted from the screen because it is a lifecycle, not a view concern, and because
 * `resumeSession` — the tab-hidden-then-visible path — went untested through session 2
 * (bead `fieldnote-5pr`). Giving it a name and a single home is what makes it testable at
 * all; `tests/unit/session-lifecycle.test.ts` covers the module underneath and
 * `tests/e2e/offline.spec.ts` covers this wiring in a real browser.
 *
 * The event choice is session 2's, restated here because it is easy to get wrong:
 * `visibilitychange` is the primary signal because it fires while the page is still fully
 * alive, so the write lands long before teardown. `pagehide` is the backstop for a tab
 * that goes straight from visible to gone. Neither fires on a crash or a force quit, and
 * that asymmetry is exactly what makes a still-open session marker meaningful.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  acknowledgeRecovery,
  beginSession,
  endSession,
  resumeSession,
  type RecoveredSession,
} from "@/lib/db";

export interface SessionLifecycle {
  /** False until the session marker has been written and any dead session read. */
  ready: boolean;
  /** Non-null when the previous session did not shut down cleanly. */
  recovered: RecoveredSession | null;
  /** Clears the dead markers so the notice does not reappear on every load. */
  dismissRecovery: () => Promise<void>;
}

/**
 * @param onSuspend Run before the session is closed — the moment to flush a pending
 *   autosave, which is the only chance to write what was typed since the last debounce.
 */
export function useSessionLifecycle(onSuspend: () => void): SessionLifecycle {
  const [ready, setReady] = useState(false);
  const [recovered, setRecovered] = useState<RecoveredSession | null>(null);

  // Held in a ref so a caller passing an inline closure does not tear down and re-add the
  // listeners on every render — a re-subscribe between `hidden` and `pagehide` would drop
  // the very event this exists to catch.
  const suspendRef = useRef(onSuspend);
  suspendRef.current = onSuspend;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const handle = await beginSession();
      if (cancelled) return;
      setRecovered(handle.recovered);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const suspend = () => {
      suspendRef.current();
      void endSession();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") suspend();
      else void resumeSession();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", suspend);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", suspend);
    };
  }, []);

  const dismissRecovery = useCallback(async () => {
    if (!recovered) return;
    await acknowledgeRecovery(recovered);
    setRecovered(null);
  }, [recovered]);

  return { ready, recovered, dismissRecovery };
}
