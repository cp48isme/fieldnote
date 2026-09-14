"use client";

/**
 * The approved content library: the passages the model may select from, entered one at
 * a time, and nothing else.
 *
 * Reached from the event switcher's list, the pattern of the last three sessions, for
 * the reason each of them gave: the header is the layout the representative validated.
 * The library is not per event — approved copy is approved copy wherever it is used —
 * so the screen is the same from any event.
 *
 * Label, body, source reference; add, edit, remove. A passage is refused at load, with
 * the rule named, when the pricing, hospitality, patient, or invented-name rule fires on
 * it or the pseudonymizer's structural guard would reject it (`src/lib/library/passages.ts`).
 * A removed passage stays referenced by id in any audit record that carried it — the
 * record survives (ADR-0008) — and the screen says so before removing.
 *
 * The public build ships with this empty. The representative loads real passages in
 * the private fork, with the approving document's code and version in the source
 * reference, per passage, so the audit record can say which approved copy a draft
 * selected from.
 */

import { useState } from "react";

import { removeApprovedContent, type ApprovedContentRecord, type Id } from "@/lib/db";
import { loadPassage, PassageRefusedError, replacePassage } from "@/lib/library/passages";

type Draft = { label: string; body: string; sourceRef: string };
const EMPTY: Draft = { label: "", body: "", sourceRef: "" };

export interface LibraryScreenProps {
  passages: ApprovedContentRecord[];
  /** Called after any change; the caller re-reads the library. */
  onChanged: () => void;
  onClose: () => void;
}

export function LibraryScreen({ passages, onChanged, onClose }: LibraryScreenProps) {
  /** Which passage the form edits: a new one, or an existing id. */
  const [editing, setEditing] = useState<"none" | "new" | Id>("none");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (target: "new" | ApprovedContentRecord) => {
    setError(null);
    if (target === "new") {
      setEditing("new");
      setDraft(EMPTY);
    } else {
      setEditing(target.id);
      setDraft({ label: target.label, body: target.body, sourceRef: target.sourceRef });
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing === "new") await loadPassage(draft);
      else if (editing !== "none") await replacePassage(editing, draft);
      setEditing("none");
      setDraft(EMPTY);
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof PassageRefusedError
          ? `Refused: ${cause.message} (rule: ${cause.rule})`
          : cause instanceof Error
            ? cause.message
            : String(cause),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (passage: ApprovedContentRecord) => {
    setBusy(true);
    try {
      await removeApprovedContent(passage.id);
      if (editing === passage.id) setEditing("none");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const canSave = draft.label.trim().length > 0 && draft.body.trim().length > 0 && !busy;

  return (
    <section
      data-testid="library"
      aria-label="Approved content"
      className="flex flex-col gap-4 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Approved content</h2>
        <button
          type="button"
          data-testid="library-close"
          onClick={onClose}
          className="min-h-11 rounded-lg border px-4 text-sm"
        >
          Back to notes
        </button>
      </div>

      <p className="text-xs opacity-70">
        The only product wording a draft may carry. The model selects from these and
        copies them exactly; anything it writes about the product in its own words is
        replaced with a gap. A passage that mentions a meal, a price, a patient, or a
        named person is refused here, because once approved it passes every check.
      </p>

      {passages.length === 0 && editing === "none" && (
        <p data-testid="library-empty" className="text-sm opacity-60">
          No passages yet. Every draft will carry a gap where product wording would go.
        </p>
      )}

      <ul data-testid="library-list" className="flex flex-col gap-2">
        {passages.map((passage) => (
          <li
            key={passage.id}
            data-testid="library-row"
            data-passage-id={passage.id}
            className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15"
          >
            <span className="font-medium">{passage.label}</span>
            <span className="whitespace-pre-wrap">{passage.body}</span>
            {passage.sourceRef && (
              <span className="text-xs opacity-60">Source: {passage.sourceRef}</span>
            )}
            <span className="flex gap-2">
              <button
                type="button"
                data-testid="library-edit"
                onClick={() => open(passage)}
                className="min-h-11 rounded-lg border px-3"
              >
                Edit
              </button>
              <button
                type="button"
                data-testid="library-remove"
                onClick={() => void remove(passage)}
                disabled={busy}
                className="min-h-11 rounded-lg border px-3"
                title="Drafts that already used this passage keep a reference to it in their audit records."
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs opacity-60">
        Removing a passage keeps its reference in the audit record of any draft that used
        it; the record is not changed.
      </p>

      {editing === "none" ? (
        <button
          type="button"
          data-testid="library-add"
          onClick={() => open("new")}
          className="min-h-11 rounded-lg border px-4 text-base font-medium"
        >
          Add a passage
        </button>
      ) : (
        <form
          data-testid="library-form"
          className="flex flex-col gap-3"
          onSubmit={(submit) => {
            submit.preventDefault();
            if (canSave) void save();
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Label</span>
            <input
              data-testid="library-label"
              value={draft.label}
              onChange={(change) => setDraft({ ...draft, label: change.target.value })}
              autoComplete="off"
              className="min-h-11 rounded-lg border px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Passage, exactly as approved</span>
            <textarea
              data-testid="library-body"
              value={draft.body}
              onChange={(change) => setDraft({ ...draft, body: change.target.value })}
              className="h-32 w-full resize-none rounded-lg border p-3 text-base leading-relaxed"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Source document and version</span>
            <input
              data-testid="library-source"
              value={draft.sourceRef}
              onChange={(change) =>
                setDraft({ ...draft, sourceRef: change.target.value })
              }
              autoComplete="off"
              className="min-h-11 rounded-lg border px-3 text-base"
            />
          </label>
          {error && (
            <p data-testid="library-error" role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              data-testid="library-save"
              disabled={!canSave}
              className="min-h-11 rounded-lg border px-4 text-base font-medium disabled:opacity-40"
            >
              {editing === "new" ? "Add" : "Save"}
            </button>
            <button
              type="button"
              data-testid="library-cancel"
              onClick={() => {
                setEditing("none");
                setError(null);
              }}
              className="min-h-11 rounded-lg border px-4 text-base"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
