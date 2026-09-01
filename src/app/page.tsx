"use client";

/**
 * Minimal harness for the session 2 data layer.
 *
 * Scope is deliberate: create an event, type into one note. Nothing else. The capture
 * dock, the log, and the rest of the capture surface are session 3, which ports an
 * already-validated prototype design — building any of it here would consume that
 * session and redesign something that does not need redesigning.
 *
 * What this page exists to do is exercise the tab-close case end to end, so autosave
 * and crash recovery are proven against a real browser rather than only in unit tests.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  acknowledgeRecovery,
  beginSession,
  createEvent,
  createNote,
  endSession,
  listEvents,
  listNotes,
  recordTouchedNote,
  saveNoteBody,
  type EventRecord,
  type NoteRecord,
  type RecoveredSession,
} from "@/lib/db";
import { useDebouncedAutosave } from "@/lib/useDebouncedAutosave";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [note, setNote] = useState<NoteRecord | null>(null);
  const [body, setBody] = useState("");
  const [recovered, setRecovered] = useState<RecoveredSession | null>(null);
  const [eventName, setEventName] = useState("");

  const noteRef = useRef<NoteRecord | null>(null);
  noteRef.current = note;

  const autosave = useDebouncedAutosave<string>(async (value) => {
    const target = noteRef.current;
    if (!target) return;
    await saveNoteBody(target.id, value);
    await recordTouchedNote(target.id);
  });

  // Open a session, surface any that died, and restore the most recent event and note.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const handle = await beginSession();
      if (cancelled) return;
      setRecovered(handle.recovered);

      const events = await listEvents();
      if (cancelled) return;

      const latest = events[0] ?? null;
      setEvent(latest);

      if (latest) {
        const notes = await listNotes(latest.id);
        if (cancelled) return;
        const existing = notes[notes.length - 1] ?? null;
        setNote(existing);
        setBody(existing?.body ?? "");
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Clean shutdown: flush the pending write, then close the session marker. A crash
  // skips both, which is exactly what makes an open marker meaningful.
  useEffect(() => {
    const onPageHide = () => {
      void autosave.flush().then(() => endSession());
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [autosave]);

  const onCreateEvent = useCallback(async () => {
    const name = eventName.trim();
    if (!name) return;
    const created = await createEvent({ name });
    const firstNote = await createNote({ eventId: created.id });
    setEvent(created);
    setNote(firstNote);
    setBody("");
    setEventName("");
  }, [eventName]);

  const onDismissRecovery = useCallback(async () => {
    if (!recovered) return;
    await acknowledgeRecovery(recovered);
    setRecovered(null);
  }, [recovered]);

  const onChangeBody = useCallback(
    (value: string) => {
      setBody(value);
      autosave.schedule(value);
    },
    [autosave],
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-xl font-semibold">Fieldnote</h1>
        <p className="text-sm opacity-70">
          Session 2 harness — data layer, autosave, and crash recovery.
        </p>
      </header>

      {recovered && (
        <section
          data-testid="recovered-session"
          role="status"
          className="rounded border border-amber-500/50 bg-amber-500/10 p-4 text-sm"
        >
          <p className="font-medium">Recovered unsaved session</p>
          <p className="mt-1 opacity-80">
            The previous session ended unexpectedly. Anything typed was saved as you went,
            and {recovered.noteIds.length} note
            {recovered.noteIds.length === 1 ? " was" : "s were"} open at the time.
          </p>
          <button
            type="button"
            data-testid="dismiss-recovery"
            onClick={() => void onDismissRecovery()}
            className="mt-3 rounded border px-3 py-1"
          >
            Dismiss
          </button>
        </section>
      )}

      {!ready && <p data-testid="loading">Loading…</p>}

      {ready && !event && (
        <section className="flex flex-col gap-2">
          <label htmlFor="event-name" className="text-sm font-medium">
            Event name
          </label>
          <input
            id="event-name"
            data-testid="event-name"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="rounded border px-3 py-2"
          />
          <button
            type="button"
            data-testid="create-event"
            onClick={() => void onCreateEvent()}
            className="self-start rounded border px-3 py-2"
          >
            Create event
          </button>
        </section>
      )}

      {ready && event && (
        <section className="flex flex-col gap-2">
          <h2 data-testid="event-name-display" className="text-lg font-medium">
            {event.name}
          </h2>
          <label htmlFor="note-body" className="text-sm font-medium">
            Note
          </label>
          <textarea
            id="note-body"
            data-testid="note-body"
            value={body}
            onChange={(e) => onChangeBody(e.target.value)}
            rows={8}
            className="rounded border p-3 font-mono text-sm"
          />
          <p
            data-testid="save-state"
            data-state={autosave.state}
            className="text-xs opacity-70"
          >
            {autosave.state === "pending" && "Saving…"}
            {autosave.state === "saved" && "Saved"}
            {autosave.state === "error" && `Save failed: ${autosave.error?.message}`}
            {autosave.state === "idle" && "No changes"}
          </p>
        </section>
      )}
    </main>
  );
}
