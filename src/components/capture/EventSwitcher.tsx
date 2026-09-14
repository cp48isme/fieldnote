"use client";

/**
 * Which event capture is writing into, and the only way to start another one.
 *
 * A `<select>` rather than a screen, deliberately: it is the same control already in the
 * dock for attribution, so it adds no new interaction to learn, and it fits in the header
 * beside the event name it replaces.
 *
 * "Start a new event…" lives in the same list because otherwise it lives nowhere. The
 * capture screen only shows the setup form when there are no events at all, so without
 * this option a representative who has run one event can never run a second.
 *
 * "Import a sign-in sheet…" lives here too (session 8), for the same reason and one
 * more: the header is the layout the representative validated, and a third button in it
 * on a phone is a change to that layout; an option in the list she already uses is not.
 * Import is a separate affordance from the dock's add-person flow, which is untouched.
 *
 * "People at this event…" (session 10) is the door to the attendee view, for the same
 * reason: the dock's attribution select shows the same names but a `<select>` cannot
 * hold a per-option action, and the follow-ups list is a list of drafts, not of people.
 *
 * "Approved content…" (session 9) is the door to the library. It is not per event, but
 * the switcher is the one list the representative already opens, and a library reached
 * from anywhere else would be a fourth control in a header that has room for none.
 */

import type { EventRecord, Id } from "@/lib/db";

/**
 * The option value meaning "not an event id". Not a valid `Id`, and checked before any
 * lookup, so it cannot be mistaken for one.
 */
const NEW_EVENT_VALUE = "__new__";
const IMPORT_ROSTER_VALUE = "__import__";
const PEOPLE_VALUE = "__people__";
const LIBRARY_VALUE = "__library__";

export interface EventSwitcherProps {
  /** Newest first, as `listEvents` returns them. */
  events: EventRecord[];
  activeEventId: Id;
  onSwitch: (eventId: Id) => void;
  onStartNew: () => void;
  onImportRoster: () => void;
  onShowPeople: () => void;
  onShowLibrary: () => void;
}

export function EventSwitcher({
  events,
  activeEventId,
  onSwitch,
  onStartNew,
  onImportRoster,
  onShowPeople,
  onShowLibrary,
}: EventSwitcherProps) {
  return (
    <>
      <label htmlFor="active-event" className="sr-only">
        Which event are you capturing for?
      </label>
      <select
        id="active-event"
        data-testid="active-event"
        value={activeEventId}
        onChange={(change) => {
          const { value } = change.target;
          if (value === NEW_EVENT_VALUE) {
            // The select stays controlled by `activeEventId`, so it snaps back to the
            // current event on the next render — including when the form is cancelled.
            onStartNew();
            return;
          }
          if (value === IMPORT_ROSTER_VALUE) {
            onImportRoster();
            return;
          }
          if (value === PEOPLE_VALUE) {
            onShowPeople();
            return;
          }
          if (value === LIBRARY_VALUE) {
            onShowLibrary();
            return;
          }
          onSwitch(value);
        }}
        className="min-h-11 max-w-[60%] flex-1 truncate rounded-lg border px-2 text-base font-semibold"
      >
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name}
          </option>
        ))}
        <option value={NEW_EVENT_VALUE}>Start a new event…</option>
        <option value={PEOPLE_VALUE}>People at this event…</option>
        <option value={IMPORT_ROSTER_VALUE}>Import a sign-in sheet…</option>
        <option value={LIBRARY_VALUE}>Approved content…</option>
      </select>
    </>
  );
}
