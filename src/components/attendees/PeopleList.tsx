"use client";

/**
 * The people at this event, as a list of doors into the attendee view.
 *
 * Reached from the event switcher beside "Start a new event…" and "Import a sign-in
 * sheet…", for the reason both of those are there: the header is the layout the
 * representative validated, and an option in a list she already uses is not a change to
 * it. The dock's attribution select shows the same names, but a `<select>` cannot hold a
 * per-option action without becoming something else, and the follow-ups list is a list
 * of drafts, not of people.
 *
 * Each row says how the person came to be here — met at the event, or from a sheet —
 * and which token class they will receive, because those are the two facts a wrong
 * record most often has wrong, and both are corrected in the view.
 */

import type { AttendeeKind, AttendeeRecord, AttendeeSource } from "@/lib/db";

export const KIND_LABELS: Record<AttendeeKind, string> = {
  hcp: "Clinician",
  staff: "Staff",
};

export const SOURCE_LABELS: Record<AttendeeSource, string> = {
  captured: "added at the event",
  imported: "from a sheet",
};

export interface PeopleListProps {
  attendees: AttendeeRecord[];
  onOpen: (attendee: AttendeeRecord) => void;
  onClose: () => void;
}

export function PeopleList({ attendees, onOpen, onClose }: PeopleListProps) {
  const sorted = [...attendees].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  return (
    <section
      data-testid="people-list"
      aria-label="People at this event"
      className="flex flex-col gap-3 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">People at this event</h2>
        <button
          type="button"
          data-testid="people-close"
          onClick={onClose}
          className="min-h-11 rounded-lg border px-4 text-sm"
        >
          Back to notes
        </button>
      </div>

      {sorted.length === 0 ? (
        <p data-testid="people-empty" className="text-sm opacity-60">
          Nobody yet. Add a person from the note dock, or import a sign-in sheet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((attendee) => (
            <li key={attendee.id}>
              <button
                type="button"
                data-testid="person-row"
                data-attendee-id={attendee.id}
                onClick={() => onOpen(attendee)}
                className="flex min-h-14 w-full flex-col gap-1 rounded-lg border border-black/10 p-3 text-left dark:border-white/15"
              >
                <span className="font-medium">{attendee.displayName}</span>
                <span className="text-xs opacity-70">
                  {KIND_LABELS[attendee.kind]}
                  {attendee.role ? ` · ${attendee.role}` : ""} ·{" "}
                  {SOURCE_LABELS[attendee.source]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
