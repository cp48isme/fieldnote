"use client";

/**
 * Debounced autosave.
 *
 * Every keystroke schedules a write; the write lands once typing pauses. The debounce
 * is deliberately short — the failure being defended against is losing an afternoon's
 * notes, and a long window trades data against a saving cost that is already trivial
 * against local IndexedDB.
 *
 * `flush()` exists so a caller can force the pending write on a clean shutdown. It does
 * not help on a crash, which is the case recovery.ts covers.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_AUTOSAVE_DEBOUNCE_MS } from "@/lib/db";

/** Re-exported from the schema, which owns it because `Settings` persists it. */
export const DEFAULT_DEBOUNCE_MS = DEFAULT_AUTOSAVE_DEBOUNCE_MS;

export type SaveState = "idle" | "pending" | "saved" | "error";

export interface AutosaveController<T> {
  /** Schedules a debounced save. Safe to call on every keystroke. */
  schedule: (value: T) => void;
  /** Writes any pending value immediately. */
  flush: () => Promise<void>;
  state: SaveState;
  /** When the last successful write completed. */
  savedAt: number | null;
  error: Error | null;
}

export function useDebouncedAutosave<T>(
  save: (value: T) => Promise<unknown>,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): AutosaveController<T> {
  const [state, setState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  /** The write currently running, so a second one queues behind it and `flush` can wait. */
  const inFlight = useRef<Promise<void> | null>(null);
  // Held in a ref so a caller passing an inline closure does not restart the debounce
  // on every render.
  //
  // The reassignment below is load-bearing, not redundant. `useRef(save)` alone captures
  // the first render's closure forever; reassigning on every render is what lets the save
  // callback see current state without the caller threading refs of its own. Callers
  // depend on that — see the autosave comment in `CaptureScreen`. Do not "tidy" it away.
  const saveRef = useRef(save);
  saveRef.current = save;

  const write = useCallback(async (): Promise<void> => {
    // Wait out a write that is already running before starting another. Two writes racing
    // on the same record is bad enough; the sharper problem is that without this, `flush`
    // could resolve while a save was still in flight, and a caller that moved the editor
    // to a different note straight afterwards would have the earlier write's completion
    // land on top of the move — pointing the editor at the previous note.
    await inFlight.current;

    const next = pending.current;
    if (!next) return;
    pending.current = null;

    const run = (async () => {
      try {
        await saveRef.current(next.value);
        setState("saved");
        setSavedAt(Date.now());
        setError(null);
      } catch (cause) {
        setState("error");
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
    })();

    inFlight.current = run;
    await run;
    if (inFlight.current === run) inFlight.current = null;
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      setState("pending");
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void write();
      }, debounceMs);
    },
    [debounceMs, write],
  );

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await write();
  }, [write]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  return { schedule, flush, state, savedAt, error };
}
