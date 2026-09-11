"use client";

/**
 * The review surface's list: every draft for this event, newest first, with its state,
 * its flags, and — once exported — its edit distance, readable together.
 *
 * That last part is the instrument (plan §4.4, and the session 6 owner constraint on
 * over-blocking). Nothing measures how often a guardrail blanks a sentence that was
 * fine; the flags per draft and the distance per draft, side by side across an event,
 * are the only data there is. So they are shown as a table, not summarised into a score
 * — the data has to exist before anyone can reason about a rate, and a threshold now
 * would be a number chosen before there is anything to choose it from.
 *
 * Opening a draft is the act that marks it reviewed (plan §4.3). A row here is a button
 * that opens the draft; rendering the row is not review, and nothing on this list can
 * export. Export lives in `DraftDetail`, behind the open.
 */

import type { AttendeeRecord, DraftRecord, DraftState, Id } from "@/lib/db";

const STATE_LABELS: Record<DraftState, string> = {
  generated: "Not yet opened",
  reviewed: "Opened",
  exported: "Exported",
  blocked: "Withheld",
};

/** Shown where a draft's recipient is no longer on the roster, or never was. */
const UNKNOWN_RECIPIENT = "Unknown recipient";

export interface FollowUpsProps {
  drafts: DraftRecord[];
  attendees: AttendeeRecord[];
  /** Exported drafts' edit distances by draft id, from their audit records. */
  distances: ReadonlyMap<Id, number>;
  canDraft: boolean;
  drafting: boolean;
  /** Something the last generation wants the representative to know. */
  notice: string | null;
  onDraft: () => void;
  onOpen: (draft: DraftRecord) => void;
  onExportAuditLog: () => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function FollowUps({
  drafts,
  attendees,
  distances,
  canDraft,
  drafting,
  notice,
  onDraft,
  onOpen,
  onExportAuditLog,
}: FollowUpsProps) {
  const namesById = new Map(attendees.map((a) => [a.id, a.displayName]));
  const exported = drafts.filter((d) => d.state === "exported");
  const withGaps = drafts.filter((d) => d.flagsFired.length > 0);
  const withheld = drafts.filter((d) => d.state === "blocked");

  return (
    <section
      data-testid="follow-ups"
      aria-label="Follow-up drafts"
      className="flex flex-col gap-3 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          data-testid="draft-follow-ups"
          onClick={onDraft}
          disabled={!canDraft || drafting}
          className="min-h-11 rounded-lg border px-4 text-base disabled:opacity-40"
        >
          {drafting ? "Drafting…" : "Draft follow-ups"}
        </button>
        <button
          type="button"
          data-testid="export-audit-log"
          onClick={onExportAuditLog}
          className="min-h-11 rounded-lg border px-4 text-sm"
        >
          Export audit log (CSV)
        </button>
      </div>

      {notice && (
        <p data-testid="follow-ups-notice" role="status" className="text-sm opacity-70">
          {notice}
        </p>
      )}

      {drafts.length === 0 ? (
        <p data-testid="follow-ups-empty" className="text-sm opacity-60">
          No drafts yet. Drafting reads every note attributed to someone and writes one
          follow-up per person.
        </p>
      ) : (
        <>
          <p data-testid="review-summary" className="text-xs opacity-60">
            {drafts.length} draft{drafts.length === 1 ? "" : "s"}: {exported.length}{" "}
            exported, {withGaps.length} with a guardrail gap, {withheld.length} withheld.
            Edit distance is how many characters changed between the draft and what was
            copied. It is a signal to read across drafts, not a mark for one: a low number
            can be a careful reader agreeing with a good draft.
          </p>

          <ul data-testid="draft-list" className="flex flex-col gap-2">
            {drafts.map((draft) => {
              const name = draft.attendeeId ? namesById.get(draft.attendeeId) : undefined;
              const distance = distances.get(draft.id);
              return (
                <li key={draft.id}>
                  <button
                    type="button"
                    data-testid="draft-row"
                    data-draft-id={draft.id}
                    data-state={draft.state}
                    onClick={() => onOpen(draft)}
                    className="flex min-h-16 w-full flex-col gap-1 rounded-lg border border-black/10 p-3 text-left dark:border-white/15"
                  >
                    <span className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="font-medium">{name ?? UNKNOWN_RECIPIENT}</span>
                      <span className="shrink-0 opacity-60">
                        {formatTime(draft.createdAt)}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                      <span data-testid="draft-row-state">
                        {STATE_LABELS[draft.state]}
                      </span>
                      {draft.flagsFired.length > 0 && (
                        <span data-testid="draft-row-flags" className="opacity-70">
                          Guardrails: {draft.flagsFired.join(", ")}
                        </span>
                      )}
                      {distance !== undefined && (
                        <span data-testid="draft-row-distance" className="opacity-70">
                          Edit distance {distance}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
