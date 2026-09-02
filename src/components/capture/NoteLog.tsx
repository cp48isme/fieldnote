"use client";

/**
 * The log: what has been captured at this event, newest first.
 *
 * Newest first because the useful question in the field is "what did I just write" far
 * more often than "what did I write this morning", and because the dock sits at the
 * bottom of the screen — the newest note should be the one nearest the thumb.
 *
 * A row is a button rather than a link or a static block. Tapping it loads that note into
 * the dock, which is also how a note captured before its person was identified gets
 * attributed later: there is no separate attribution screen, because there does not need
 * to be one.
 */

import type { AttendeeRecord, Id, NoteRecord } from "@/lib/db";

/** Shown in place of a name when a note is not yet attributed to anyone. */
const UNATTRIBUTED_LABEL = "Not yet attributed";

/** What a row shows of a note that has been opened but not yet typed into. */
const EMPTY_BODY_LABEL = "Empty note";

export interface NoteLogProps {
  /** Newest first. */
  notes: NoteRecord[];
  attendees: AttendeeRecord[];
  /** The note currently loaded in the dock, marked so the two surfaces agree. */
  activeNoteId: Id | null;
  onOpenNote: (note: NoteRecord) => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NoteLog({ notes, attendees, activeNoteId, onOpenNote }: NoteLogProps) {
  const namesById = new Map(attendees.map((a) => [a.id, a.displayName]));

  if (notes.length === 0) {
    return (
      <p data-testid="log-empty" className="p-4 text-sm opacity-60">
        Nothing captured yet. Start typing below — the note saves itself as you go.
      </p>
    );
  }

  return (
    <ul data-testid="note-log" className="flex flex-col gap-2 p-4">
      {notes.map((note) => {
        const name = note.attendeeId ? namesById.get(note.attendeeId) : undefined;
        const isActive = note.id === activeNoteId;

        return (
          <li key={note.id}>
            <button
              type="button"
              data-testid="log-row"
              data-note-id={note.id}
              data-active={isActive}
              onClick={() => onOpenNote(note)}
              className={`flex min-h-16 w-full flex-col gap-1 rounded-lg border p-3 text-left ${
                isActive
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-black/10 dark:border-white/15"
              }`}
            >
              <span className="flex items-baseline justify-between gap-3 text-xs">
                <span className={name ? "font-medium" : "font-medium opacity-60"}>
                  {name ?? UNATTRIBUTED_LABEL}
                </span>
                <span className="shrink-0 opacity-60">{formatTime(note.createdAt)}</span>
              </span>
              <span
                className={`line-clamp-2 text-sm ${note.body.trim() ? "" : "opacity-50"}`}
              >
                {note.body.trim() || EMPTY_BODY_LABEL}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
