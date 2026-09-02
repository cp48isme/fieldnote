"use client";

/**
 * The recovered-session state.
 *
 * Plan §3.1 asks for this to be explicit rather than a silent restore, and the reason is
 * worth keeping in view: the data is already on disk because autosave put it there, so
 * nothing here restores anything. What the notice adds is telling the representative that
 * the last session ended unexpectedly and how much was open at the time. A silent restore
 * leaves someone unsure whether what they are looking at is everything they wrote, which
 * is the same anxiety as losing it.
 *
 * It sits above the log rather than over it. A modal would be in the way of the one
 * action that matters, which is writing the next note.
 */

import type { RecoveredSession } from "@/lib/db";

export interface RecoveryNoticeProps {
  recovered: RecoveredSession;
  onDismiss: () => void;
}

export function RecoveryNotice({ recovered, onDismiss }: RecoveryNoticeProps) {
  const count = recovered.noteIds.length;

  return (
    <section
      data-testid="recovered-session"
      role="status"
      className="mx-4 mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm"
    >
      <p className="font-medium">Recovered unsaved session</p>
      <p className="mt-1 opacity-80">
        The previous session ended unexpectedly. Everything typed was saved as you went
        {count === 0
          ? ", and nothing was open at the time."
          : `, and ${count} note${count === 1 ? " was" : "s were"} open at the time.`}
      </p>
      <button
        type="button"
        data-testid="dismiss-recovery"
        onClick={onDismiss}
        className="mt-3 min-h-11 rounded-lg border px-4 text-sm font-medium"
      >
        Dismiss
      </button>
    </section>
  );
}
