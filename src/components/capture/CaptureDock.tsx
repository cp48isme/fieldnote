"use client";

/**
 * The capture dock: the one surface that has to work perfectly.
 *
 * It is used standing up, one-handed, with a software keyboard covering half the screen,
 * to *correct* text the operating system's dictation got wrong — mangled surnames,
 * missing punctuation, "period" landing as a word. Per ADR-0005 the app records no audio
 * and knows nothing about dictation; dictated text arrives here as ordinary typed text,
 * and there is no source recording to fall back on, which is exactly why correcting it
 * has to be comfortable.
 *
 * Four decisions follow from that, and each is a deliberate trade:
 *
 *   - **The textarea has a fixed height and scrolls internally.** An auto-growing box
 *     reflows the log above it on every line, so the text under the thumb moves while
 *     being edited. Holding the height still costs a scroll on long notes and is worth it.
 *   - **The value is never written back from the save path.** Autosave reads the state; it
 *     does not set it. Assigning the persisted string back into a controlled textarea
 *     resets the caret to the end, which mid-correction moves the cursor away from the
 *     word being fixed. This is the single most important line in the file, and it is a
 *     line that isn't here.
 *   - **The dock is always mounted**, even before a note exists. A conditionally rendered
 *     textarea unmounts and remounts as state changes around it, and a remount loses focus
 *     and the software keyboard with it.
 *   - **16px type and 44px targets.** Anything smaller than 16px makes iOS zoom the page
 *     on focus, which shifts the layout sideways mid-sentence.
 */

import { useState } from "react";

import type { AttendeeRecord, Id } from "@/lib/db";
import type { SaveState } from "@/lib/useDebouncedAutosave";

/** The `<select>` value standing in for "no attendee". `null` is not expressible in the DOM. */
const UNATTRIBUTED_VALUE = "";

const SAVE_STATE_LABELS: Record<SaveState, string> = {
  idle: "Saved automatically",
  pending: "Saving…",
  saved: "Saved",
  error: "Not saved",
};

export interface CaptureDockProps {
  body: string;
  onBodyChange: (value: string) => void;
  attendees: AttendeeRecord[];
  attendeeId: Id | null;
  onAttributionChange: (attendeeId: Id | null) => void;
  onAddAttendee: (displayName: string) => void;
  onNewNote: () => void;
  /** False before the first keystroke of a fresh note, when there is nothing to clear. */
  canStartNewNote: boolean;
  saveState: SaveState;
  saveError: Error | null;
}

export function CaptureDock({
  body,
  onBodyChange,
  attendees,
  attendeeId,
  onAttributionChange,
  onAddAttendee,
  onNewNote,
  canStartNewNote,
  saveState,
  saveError,
}: CaptureDockProps) {
  const [newPersonName, setNewPersonName] = useState<string | null>(null);
  const trimmedNewPerson = newPersonName?.trim() ?? "";

  return (
    <div
      data-testid="capture-dock"
      // `sticky` rather than `fixed`: the visual viewport shrinks when the software
      // keyboard opens, and a sticky element inside a dvh-sized column stays above it
      // where a fixed one is pushed underneath. The safe-area inset keeps it clear of the
      // home indicator without leaving a permanent gap on devices that have none.
      className="sticky bottom-0 shrink-0 border-t border-black/10 bg-[var(--background)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/15"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="note-attendee" className="sr-only">
            Who is this note about?
          </label>
          <select
            id="note-attendee"
            data-testid="note-attendee"
            value={attendeeId ?? UNATTRIBUTED_VALUE}
            onChange={(change) =>
              onAttributionChange(
                change.target.value === UNATTRIBUTED_VALUE ? null : change.target.value,
              )
            }
            className="min-h-11 flex-1 rounded-lg border px-3 text-base"
          >
            <option value={UNATTRIBUTED_VALUE}>Not yet attributed</option>
            {attendees.map((attendee) => (
              <option key={attendee.id} value={attendee.id}>
                {attendee.displayName}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="toggle-add-attendee"
            onClick={() => setNewPersonName((open) => (open === null ? "" : null))}
            aria-expanded={newPersonName !== null}
            className="min-h-11 shrink-0 rounded-lg border px-4 text-base"
          >
            {newPersonName === null ? "Add person" : "Cancel"}
          </button>
        </div>

        {newPersonName !== null && (
          <form
            className="flex items-center gap-2"
            onSubmit={(submit) => {
              submit.preventDefault();
              if (!trimmedNewPerson) return;
              onAddAttendee(trimmedNewPerson);
              setNewPersonName(null);
            }}
          >
            <label htmlFor="new-attendee-name" className="sr-only">
              Name
            </label>
            <input
              id="new-attendee-name"
              data-testid="new-attendee-name"
              value={newPersonName}
              onChange={(change) => setNewPersonName(change.target.value)}
              autoComplete="off"
              autoFocus
              className="min-h-11 flex-1 rounded-lg border px-3 text-base"
            />
            <button
              type="submit"
              data-testid="save-attendee"
              disabled={trimmedNewPerson.length === 0}
              className="min-h-11 shrink-0 rounded-lg border px-4 text-base font-medium disabled:opacity-40"
            >
              Add
            </button>
          </form>
        )}

        <label htmlFor="note-body" className="sr-only">
          Note
        </label>
        <textarea
          id="note-body"
          data-testid="note-body"
          value={body}
          onChange={(change) => onBodyChange(change.target.value)}
          placeholder="What just happened?"
          // Dictated text arrives unpunctuated and misspelled; every correction aid the
          // platform offers is wanted here.
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          className="h-44 w-full resize-none rounded-lg border p-3 text-base leading-relaxed"
        />

        <div className="flex items-center justify-between gap-3">
          <p
            data-testid="save-state"
            data-state={saveState}
            className={`text-xs ${saveState === "error" ? "text-red-600" : "opacity-60"}`}
          >
            {saveState === "error" && saveError
              ? `${SAVE_STATE_LABELS.error}: ${saveError.message}`
              : SAVE_STATE_LABELS[saveState]}
          </p>
          <button
            type="button"
            data-testid="new-note"
            onClick={onNewNote}
            disabled={!canStartNewNote}
            className="min-h-11 shrink-0 rounded-lg border px-4 text-base font-medium disabled:opacity-40"
          >
            New note
          </button>
        </div>
      </div>
    </div>
  );
}
