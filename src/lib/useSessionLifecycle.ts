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
  /** True once the session has been opened, or once opening it has failed. */
  ready: boolean;
  /** Non-null when the previous session did not shut down cleanly. */
  recovered: RecoveredSession | null;
  /**
   * False when the session marker could not be written. Capture still works; what is lost
   * is the ability to notice that *this* session died, so the next load will not be able to
   * report it. The screen says so rather than pretending recovery is armed.
   */
  recoveryAvailable: boolean;
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
  const [recoveryAvailable, setRecoveryAvailable] = useState(true);

  // Held in a ref so a caller passing an inline closure does not tear down and re-add the
  // listeners on every render — a re-subscribe between `hidden` and `pagehide` would drop
  // the very event this exists to catch.
  const suspendRef = useRef(onSuspend);
  suspendRef.current = onSuspend;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const handle = await beginSession();
        if (cancelled) return;
        setRecovered(handle.recovered);
      } catch (cause) {
        // Crash recovery is bookkeeping, not persistence. Losing it must not cost capture:
        // an unopened session marker means the next load cannot report that this one died,
        // which is worth telling the user and is not worth refusing to work over.
        //
        // This is the specific path that hung. `ready` gated the whole screen and only the
        // success branch set it, so a throw here left "Loading…" on screen for good.
        if (cancelled) return;
        setRecoveryAvailable(false);
        console.warn("Session marker unavailable; crash recovery is off.", cause);
      } finally {
        if (!cancelled) setReady(true);
      }
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

  return { ready, recovered, recoveryAvailable, dismissRecovery };
}
