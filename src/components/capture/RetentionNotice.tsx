"use client";

/**
 * What this event's content will be deleted, and when. ADR-0013.
 *
 * A notice and not a prompt, which is the decision rather than a styling choice: there is
 * no button, no dismissal, and no export offer. The correspondence that matters has left
 * by her mail client and is the record kept elsewhere; what the store holds is working
 * material, and the app saying so once a week before it goes is the whole of what she
 * needs. A dismissal would also have to be stored, and the schema stays at v9.
 *
 * It shows on every load through the seven days before the deletion date, because nothing
 * records that she has seen it. That is the cost of storing nothing, taken deliberately.
 */

import { formatDeletionDate, type Retention } from "@/lib/db";

export function RetentionNotice({ retention }: { retention: Retention }) {
  if (retention.state !== "notice") return null;

  return (
    <p
      role="status"
      data-testid="retention-notice"
      data-days-remaining={retention.daysRemaining}
      className="mx-4 mt-4 rounded-lg border border-amber-700 bg-amber-500/10 p-4 text-sm"
    >
      This event&apos;s notes, drafts, people, contacts, and photos will be deleted on{" "}
      <strong data-testid="retention-date">{formatDeletionDate(retention.dueAt)}</strong>.
      Anything you still need should leave this device before then. The audit records are
      kept.
    </p>
  );
}
