"use client";

/**
 * One draft, open. Reaching this view is what moved the draft to `reviewed` — the
 * screen that owns the data calls `markReviewed` before rendering it — so everything
 * here is downstream of a human having opened the draft.
 *
 * Three things it does, and one it refuses to do:
 *
 *   - **Explains the gaps.** Every flag that fired is named with what it means, and the
 *     gap marker is explained in a sentence, so the representative knows why a line is
 *     missing without reading an audit log.
 *   - **Lets the text be edited**, with the same textarea rules as the capture dock:
 *     fixed height, 16px type, the value never written back from the save path.
 *   - **Copies to the mail client and records that it did.** The copy happens first;
 *     the export is recorded only once the clipboard has the text, because an export
 *     the clipboard refused did not happen. After that the text is read-only and the
 *     edit distance is shown with what it does and does not mean.
 *   - **Never sends.** There is no mail API here and there will not be one (CLAUDE.md).
 *
 * The export button's enabled state is read from the transition table via `canExport`,
 * not decided here. For a blocked draft there is no editor and no button, because
 * there is no body — only the reason it was withheld.
 */

import { useState } from "react";

import { canExport, type AuditRecordRecord, type DraftRecord } from "@/lib/db";
import { explanationFor } from "@/lib/generation/pipeline";
import { GAP_MARKER } from "@/lib/generation/prompt";
import { describeFlag } from "@/lib/review/flags";
import type { SaveState } from "@/lib/useDebouncedAutosave";

const SAVE_STATE_LABELS: Record<SaveState, string> = {
  idle: "Edits save automatically",
  pending: "Saving…",
  saved: "Saved",
  error: "Not saved",
};

export interface DraftDetailProps {
  draft: DraftRecord;
  audit: AuditRecordRecord | null;
  recipientName: string;
  body: string;
  onBodyChange: (value: string) => void;
  saveState: SaveState;
  onBack: () => void;
  /** Copies `body` and records the export. Rejects if either step fails. */
  onExport: () => Promise<void>;
  /** Copies again after export; records nothing. */
  onCopyAgain: () => Promise<void>;
}

export function DraftDetail({
  draft,
  audit,
  recipientName,
  body,
  onBodyChange,
  saveState,
  onBack,
  onExport,
  onCopyAgain,
}: DraftDetailProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copiedAgain, setCopiedAgain] = useState(false);

  const exportable = canExport(draft.state);
  const exported = draft.state === "exported";
  const hasGap = body.includes(GAP_MARKER) || draft.generatedBody.includes(GAP_MARKER);

  const runExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await onExport();
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section
      data-testid="draft-detail"
      data-state={draft.state}
      aria-label={`Draft for ${recipientName}`}
      className="flex flex-col gap-3 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          data-testid="back-to-drafts"
          onClick={onBack}
          className="min-h-11 rounded-lg border px-4 text-sm"
        >
          Back
        </button>
        <h2 className="truncate text-sm font-semibold">{recipientName}</h2>
      </div>

      {draft.state === "blocked" && draft.blocked ? (
        <p
          data-testid="draft-blocked"
          role="status"
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
        >
          {explanationFor(draft.blocked)}
        </p>
      ) : (
        <>
          {(draft.flagsFired.length > 0 || hasGap) && (
            <div
              data-testid="draft-flags"
              className="flex flex-col gap-1 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15"
            >
              {hasGap && (
                <p>
                  Where the draft says <code>{GAP_MARKER}</code>, the model was not
                  allowed to describe the product. Write that part yourself or leave it
                  out.
                </p>
              )}
              {draft.flagsFired.map((flag) => (
                <p
                  key={flag}
                  data-testid="draft-flag"
                  data-flag={flag}
                  className="opacity-80"
                >
                  <span className="font-medium">{flag}</span>: {describeFlag(flag)}
                </p>
              ))}
            </div>
          )}

          <textarea
            data-testid="draft-editor"
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            readOnly={exported}
            aria-label="Draft text"
            className="h-72 w-full resize-none rounded-lg border border-black/10 p-3 text-base leading-relaxed dark:border-white/15"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            {!exported ? (
              <>
                <p data-testid="draft-save-state" className="text-xs opacity-60">
                  {SAVE_STATE_LABELS[saveState]}
                </p>
                <button
                  type="button"
                  data-testid="export-draft"
                  onClick={() => void runExport()}
                  disabled={!exportable || exporting}
                  className="min-h-11 rounded-lg border px-4 text-base disabled:opacity-40"
                >
                  {exporting ? "Copying…" : "Copy to mail client"}
                </button>
              </>
            ) : (
              <>
                <p data-testid="export-state" role="status" className="text-sm">
                  Copied to the clipboard and recorded
                  {audit?.exportedAt
                    ? ` at ${new Date(audit.exportedAt).toLocaleTimeString()}`
                    : ""}
                  . Paste it into your own mail client; nothing is sent from here.
                </p>
                <button
                  type="button"
                  data-testid="copy-again"
                  onClick={() => void onCopyAgain().then(() => setCopiedAgain(true))}
                  className="min-h-11 rounded-lg border px-4 text-sm"
                >
                  {copiedAgain ? "Copied" : "Copy again"}
                </button>
              </>
            )}
          </div>

          {exportError && (
            <p data-testid="export-error" role="alert" className="text-sm text-red-600">
              {exportError}
            </p>
          )}

          {exported && audit && audit.editDistance !== null && (
            <p
              data-testid="edit-distance"
              data-distance={audit.editDistance}
              className="text-xs opacity-70"
            >
              Edit distance {audit.editDistance}: {audit.editDistance} character
              {audit.editDistance === 1 ? "" : "s"} changed between the generated draft
              and what was copied. It records how much was changed, not how carefully it
              was read — a low number can be a careful reader agreeing with a good draft.
            </p>
          )}
        </>
      )}
    </section>
  );
}
