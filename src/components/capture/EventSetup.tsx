"use client";

/**
 * What the app shows when there is no event yet.
 *
 * Deliberately one field. An event needs a name to be findable later; everything else the
 * schema allows — site label, start time — can be filled in when there is a spare moment,
 * and asking for it here would put a form between the representative and the first note
 * of the day.
 */

import { useState } from "react";

export interface EventSetupProps {
  onCreate: (name: string) => void;
}

export function EventSetup({ onCreate }: EventSetupProps) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  return (
    <form
      className="flex flex-col gap-3 p-4"
      onSubmit={(submit) => {
        submit.preventDefault();
        if (trimmed) onCreate(trimmed);
      }}
    >
      <label htmlFor="event-name" className="text-sm font-medium">
        What event is this?
      </label>
      <input
        id="event-name"
        data-testid="event-name"
        value={name}
        onChange={(change) => setName(change.target.value)}
        autoComplete="off"
        // 16px, like the note textarea: anything smaller makes iOS zoom the page on focus.
        className="min-h-12 rounded-lg border px-4 text-base"
      />
      <button
        type="submit"
        data-testid="create-event"
        disabled={trimmed.length === 0}
        className="min-h-12 self-start rounded-lg border px-5 text-base font-medium disabled:opacity-40"
      >
        Start capturing
      </button>
    </form>
  );
}
