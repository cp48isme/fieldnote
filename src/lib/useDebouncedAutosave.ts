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

export const DEFAULT_DEBOUNCE_MS = 300;

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
  // Held in a ref so a caller passing an inline closure does not restart the debounce
  // on every render.
  const saveRef = useRef(save);
  saveRef.current = save;

  const write = useCallback(async () => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    try {
      await saveRef.current(next.value);
      setState("saved");
      setSavedAt(Date.now());
      setError(null);
    } catch (cause) {
      setState("error");
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    }
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
