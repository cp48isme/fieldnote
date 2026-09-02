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
 */

import type { EventRecord, Id } from "@/lib/db";

/**
 * The option value meaning "not an event id". Not a valid `Id`, and checked before any
 * lookup, so it cannot be mistaken for one.
 */
const NEW_EVENT_VALUE = "__new__";

export interface EventSwitcherProps {
  /** Newest first, as `listEvents` returns them. */
  events: EventRecord[];
  activeEventId: Id;
  onSwitch: (eventId: Id) => void;
  onStartNew: () => void;
}

export function EventSwitcher({
  events,
  activeEventId,
  onSwitch,
  onStartNew,
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
      </select>
    </>
  );
}
