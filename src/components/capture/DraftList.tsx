"use client";

/**
 * THROWAWAY. Session 6 deletes this file and replaces it with the review surface.
 *
 * This is the proof that the generation pipeline works end to end — names and roles
 * tokenized in the payload, correct in what the representative reads — and nothing more.
 * It persists nothing (session 5 generates without audit records, so drafts live in
 * memory and are gone on reload; that is deliberate, see `pipeline.ts`), it has no draft
 * state, no review gate, and no export. Do not build on it: `fieldnote-xjs` says nothing
 * builds on the capture layout until the representative has been observed using it, and
 * the review surface is the first thing that will.
 *
 * Bead: `fieldnote-aev`.
 */

import type { AttendeeRecord } from "@/lib/db";
import type { BatchResult } from "@/lib/generation/pipeline";

export interface DraftListProps {
  batch: BatchResult;
  attendees: AttendeeRecord[];
  onDismiss: () => void;
}

export function DraftList({ batch, attendees, onDismiss }: DraftListProps) {
  const namesById = new Map(attendees.map((a) => [a.id, a.displayName]));

  return (
    <section
      data-testid="draft-list"
      aria-label="Generated drafts"
      className="m-4 flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">
          {batch.drafts.length} draft{batch.drafts.length === 1 ? "" : "s"}, held in
          memory only
        </h2>
        <button
          type="button"
          data-testid="dismiss-drafts"
          onClick={onDismiss}
          className="min-h-11 rounded-lg border px-4 text-base"
        >
          Close
        </button>
      </div>

      <p className="text-xs opacity-60">
        Nothing here is saved or sent. Review, persistence, and export arrive in session
        6.
        {batch.unattributedNotes > 0 &&
          ` ${batch.unattributedNotes} note${batch.unattributedNotes === 1 ? "" : "s"} not yet attributed to anyone ${batch.unattributedNotes === 1 ? "was" : "were"} left out.`}
      </p>

      {batch.drafts.map((draft) => (
        <article
          key={draft.attendeeId}
          data-testid="draft"
          data-blocked={draft.blocked ?? "none"}
          className="rounded-lg border border-black/10 p-3 dark:border-white/15"
        >
          <h3 className="text-sm font-semibold">
            {namesById.get(draft.attendeeId) ?? "Unknown attendee"}
          </h3>
          {draft.blocked ? (
            <p data-testid="draft-blocked" className="mt-2 text-sm">
              {draft.explanation}
            </p>
          ) : (
            <pre
              data-testid="draft-body"
              className="mt-2 whitespace-pre-wrap font-[inherit] text-base"
            >
              {draft.body}
            </pre>
          )}
          {draft.flagsFired.length > 0 && (
            <p data-testid="draft-flags" className="mt-2 text-xs opacity-60">
              Guardrails fired: {draft.flagsFired.join(", ")}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
