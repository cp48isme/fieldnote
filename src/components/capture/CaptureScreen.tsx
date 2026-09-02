"use client";

/**
 * The capture screen. Holds the state, owns every call into the data layer, and passes
 * plain props down — the dock and the log render what they are given and nothing else.
 *
 * Everything here goes through `@/lib/db`. No module outside `src/lib/db/` imports Dexie,
 * and `tests/unit/db-boundary.test.ts` fails the build if one does.
 *
 * Three behaviours are worth reading before changing anything:
 *
 * **A note is created on the first save, not on arrival.** Opening the app does not write
 * an empty row, and neither does tapping into the textarea. The debounced save creates the
 * note if there isn't one, then writes the body. Without this the log fills with empty
 * notes from every time the app was opened and closed.
 *
 * **The most recent note is restored into the dock on load.** Reopening the app puts you
 * back where you were, mid-sentence, which is the whole point of the persistence work in
 * session 2. The alternative — always opening to a blank dock — is defensible and would
 * make an accidental append impossible, but it hides the half-finished note behind a tap
 * at exactly the moment someone is checking whether they lost it.
 *
 * **Attribution is state here, not on the note.** A note can be captured before anyone
 * knows whose it is (`NoteRecord.attendeeId` is nullable for that reason), so the dock's
 * selection is held here and applied at creation, or written through `attributeNote` when
 * the note already exists.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  attributeNote,
  createAttendee,
  createEvent,
  createNote,
  getActiveEventId,
  listAttendees,
  listEvents,
  listNotes,
  recordTouchedNote,
  saveNoteBody,
  setActiveEventId,
  type AttendeeRecord,
  type EventRecord,
  type Id,
  type NoteRecord,
} from "@/lib/db";
import { useDebouncedAutosave } from "@/lib/useDebouncedAutosave";
import { useSessionLifecycle } from "@/lib/useSessionLifecycle";

import { CaptureDock } from "./CaptureDock";
import { EventSetup } from "./EventSetup";
import { EventSwitcher } from "./EventSwitcher";
import { NoteLog } from "./NoteLog";
import { RecoveryNotice } from "./RecoveryNotice";

export function CaptureScreen() {
  const [loaded, setLoaded] = useState(false);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [event, setEvent] = useState<EventRecord | null>(null);
  /** True while the new-event form is up, so the dock cannot be typed into meanwhile. */
  const [startingNewEvent, setStartingNewEvent] = useState(false);
  const [attendees, setAttendees] = useState<AttendeeRecord[]>([]);
  /** Oldest first, as `listNotes` returns them. Reversed for display. */
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [activeNote, setActiveNote] = useState<NoteRecord | null>(null);
  const [attendeeId, setAttendeeId] = useState<Id | null>(null);
  const [body, setBody] = useState("");

  /**
   * In-flight `createNote`, so two saves racing on a brand-new note cannot each create
   * one. Cleared whenever the dock moves to a different note.
   */
  const creating = useRef<Promise<NoteRecord> | null>(null);

  const refreshNotes = useCallback(async (eventId: Id) => {
    setNotes(await listNotes(eventId));
  }, []);

  /**
   * The autosave target. `useDebouncedAutosave` re-reads this closure on every render, so
   * it always sees current state and needs no refs of its own.
   */
  const autosave = useDebouncedAutosave<string>(async (value) => {
    if (!event) return;

    let target = activeNote;
    if (!target) {
      // Created empty and written immediately below, rather than created with `value`.
      // Two saves racing on a brand-new note both await this one promise; if the body
      // were baked into creation, the second one's keystrokes would be dropped on the
      // floor. One extra write, once per note, buys that away.
      creating.current ??= createNote({ eventId: event.id, attendeeId });
      target = await creating.current;
      setActiveNote(target);
    }

    await saveNoteBody(target.id, value);
    await recordTouchedNote(target.id);
    await refreshNotes(event.id);
  });

  const session = useSessionLifecycle(
    useCallback(() => {
      void autosave.flush();
    }, [autosave]),
  );

  /**
   * Points the whole screen at an event: its people, its log, and the note that was open
   * in it. Shared by first load, switching, and creating, so all three land in the same
   * state — the restore-the-most-recent-note behaviour is a property of opening an event,
   * not something the load path does specially.
   */
  const openEvent = useCallback(async (target: EventRecord) => {
    const [people, captured] = await Promise.all([
      listAttendees(target.id),
      listNotes(target.id),
    ]);

    setEvent(target);
    setAttendees(people);
    setNotes(captured);

    const open = captured[captured.length - 1] ?? null;
    setActiveNote(open);
    setBody(open?.body ?? "");
    setAttendeeId(open?.attendeeId ?? null);
    setStartingNewEvent(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [all, activeId] = await Promise.all([listEvents(), getActiveEventId()]);
      if (cancelled) return;

      setEvents(all);
      // The stored choice wins. Falling back to the newest matters when the setting has
      // never been written, or points at an event that has since been deleted.
      const target = all.find((candidate) => candidate.id === activeId) ?? all[0] ?? null;
      if (target) await openEvent(target);
      if (cancelled) return;

      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [openEvent]);

  /**
   * Moves capture to a different event.
   *
   * The flush is first and is not optional: keystrokes still sitting in the debounce
   * belong to the note in the event being left. Clearing `creating` afterwards matters for
   * the same reason — it holds an in-flight `createNote` for the *previous* event, and a
   * later first keystroke would otherwise resolve to that promise and write into the wrong
   * event's note. Resetting `attendeeId` is the third: an attendee id from event A applied
   * to a note in event B is a cross-event reference the schema will happily store.
   *
   * `openEvent` resets all three of `activeNote`, `body`, and `attendeeId` from the target.
   */
  const switchEvent = useCallback(
    async (eventId: Id) => {
      const target = events.find((candidate) => candidate.id === eventId);
      if (!target || target.id === event?.id) return;

      await autosave.flush();
      creating.current = null;

      await setActiveEventId(target.id);
      await openEvent(target);
    },
    [autosave, event, events, openEvent],
  );

  const onCreateEvent = useCallback(
    async (name: string) => {
      // Same discipline as switching: anything pending belongs to the outgoing event.
      await autosave.flush();
      creating.current = null;

      const created = await createEvent({ name });
      setEvents(await listEvents());
      await setActiveEventId(created.id);
      await openEvent(created);
    },
    [autosave, openEvent],
  );

  const onBodyChange = useCallback(
    (value: string) => {
      setBody(value);
      autosave.schedule(value);
    },
    [autosave],
  );

  /** Moves the dock to a different note — or to none — writing anything pending first. */
  const moveTo = useCallback(
    async (note: NoteRecord | null) => {
      await autosave.flush();
      creating.current = null;
      setActiveNote(note);
      setBody(note?.body ?? "");
      setAttendeeId(note?.attendeeId ?? null);
      if (event) await refreshNotes(event.id);
    },
    [autosave, event, refreshNotes],
  );

  const onAttributionChange = useCallback(
    async (next: Id | null) => {
      setAttendeeId(next);
      if (!activeNote || !event) return;
      const updated = await attributeNote(activeNote.id, next);
      setActiveNote(updated);
      await refreshNotes(event.id);
    },
    [activeNote, event, refreshNotes],
  );

  const onAddAttendee = useCallback(
    async (displayName: string) => {
      if (!event) return;
      const added = await createAttendee({ eventId: event.id, displayName });
      setAttendees(await listAttendees(event.id));
      // Attribute to the person just added: adding them here means this note is theirs.
      await onAttributionChange(added.id);
    },
    [event, onAttributionChange],
  );

  const ready = loaded && session.ready;

  if (!ready) {
    return (
      <main className="flex h-[100dvh] items-center justify-center">
        <p data-testid="loading" className="text-sm opacity-60">
          Loading…
        </p>
      </main>
    );
  }

  return (
    // A dvh-sized column, so the log scrolls and the dock stays put when the software
    // keyboard opens. `min-h-0` on the scroller is what stops flexbox growing the column
    // past the viewport instead of scrolling inside it.
    <main className="flex h-[100dvh] flex-col">
      <header className="shrink-0 border-b border-black/10 px-4 py-3 dark:border-white/15">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {event ? (
            <EventSwitcher
              events={events}
              activeEventId={event.id}
              onSwitch={(eventId) => void switchEvent(eventId)}
              onStartNew={() => setStartingNewEvent(true)}
            />
          ) : (
            <h1 className="truncate text-base font-semibold">Fieldnote</h1>
          )}
          {event && (
            <p className="shrink-0 text-xs opacity-60">
              {/* The event name also lives here as text, so tests and screen readers have
                  something stable to read that is not the select's own value. */}
              <span data-testid="event-name-display" className="sr-only">
                {event.name}
              </span>
              {notes.length} note{notes.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl">
          {session.recovered && (
            <RecoveryNotice
              recovered={session.recovered}
              onDismiss={() => void session.dismissRecovery()}
            />
          )}

          {(!event || startingNewEvent) && (
            <EventSetup
              onCreate={(name) => void onCreateEvent(name)}
              onCancel={event ? () => setStartingNewEvent(false) : undefined}
            />
          )}

          {event && !startingNewEvent && (
            <NoteLog
              notes={[...notes].reverse()}
              attendees={attendees}
              activeNoteId={activeNote?.id ?? null}
              onOpenNote={(note) => void moveTo(note)}
            />
          )}
        </div>
      </div>

      {event && !startingNewEvent && (
        <CaptureDock
          body={body}
          onBodyChange={onBodyChange}
          attendees={attendees}
          attendeeId={attendeeId}
          onAttributionChange={(next) => void onAttributionChange(next)}
          onAddAttendee={(displayName) => void onAddAttendee(displayName)}
          onNewNote={() => void moveTo(null)}
          canStartNewNote={activeNote !== null || body.length > 0}
          saveState={autosave.state}
          saveError={autosave.error}
        />
      )}
    </main>
  );
}
