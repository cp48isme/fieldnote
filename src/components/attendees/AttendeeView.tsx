"use client";

/**
 * One person: their record, editable, and what this device holds about them.
 *
 * Plan §2 names this — names, specialties, institutions, clinical interests, procurement
 * influence, assembled without the person's knowledge — as the second most serious issue
 * in the project. The view reads like it knows that. Its first line says what it shows
 * is what this device holds and that nothing is fetched; there is no suggested opener
 * and no suggested anything (ADR-0009); and the history is joined across events by name
 * alone, which the view states, because a join it did not state would be a profile the
 * reader could not audit.
 *
 * The five fields are edited in place and saved on one button. `source` is shown and
 * not editable: how a record arrived is history, not opinion. A display-name change is
 * an ordinary update — `updateAttendee` says why it touches no existing draft or audit
 * record — and the dock's attribution select shows the new name on the next render.
 *
 * Session 11 adds the two things the briefing takes from this record and nothing else
 * does: a photo, uploaded by the representative and never fetched (plan §3.2), resized
 * on the device to a thumbnail before it is stored as bytes; and her briefing notes —
 * the opener and the talking points ADR-0009 withdrew from the model — autosaved like a
 * note body. Neither is sent anywhere. The dictated notes below them are not in the
 * briefing; the copy says so.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import {
  getImage,
  putImage,
  removeImage,
  saveAttendeeBriefingNotes,
  type AttendeeEdit,
  type AttendeeKind,
  type AttendeeRecord,
  type DraftRecord,
  type ImageRecord,
} from "@/lib/db";
import { loadHistory, type AttendeeHistory } from "@/lib/attendees/history";
import { canvasSurface } from "@/lib/images/canvas-surface";
import { dataUrlOf } from "@/lib/images/data-url";
import { PhotoError, resizePhoto } from "@/lib/images/resize";
import { useDebouncedAutosave } from "@/lib/useDebouncedAutosave";

import { KIND_LABELS, SOURCE_LABELS } from "./PeopleList";

const DRAFT_STATE_LABELS: Record<DraftRecord["state"], string> = {
  generated: "Not yet opened",
  reviewed: "Opened",
  exported: "Exported",
  blocked: "Withheld",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface AttendeeViewProps {
  attendee: AttendeeRecord;
  /** Saves the five fields; the caller re-reads the roster. Rejects on failure. */
  onSave: (edit: AttendeeEdit) => Promise<void>;
  /** Opens a draft in the review detail; the caller handles the event it belongs to. */
  onOpenDraft: (draft: DraftRecord) => void;
  onBack: () => void;
  /** Removes the record after the confirmation below; the caller re-reads and leaves. */
  onDelete: () => Promise<void>;
}

export function AttendeeView({
  attendee,
  onSave,
  onOpenDraft,
  onBack,
  onDelete,
}: AttendeeViewProps) {
  const [deleting, setDeleting] = useState(false);
  const [edit, setEdit] = useState<AttendeeEdit>({
    displayName: attendee.displayName,
    kind: attendee.kind,
    role: attendee.role,
    specialty: attendee.specialty,
    institution: attendee.institution,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AttendeeHistory | null>(null);
  /** Null while loading or when there is none; the record when there is. */
  const [photo, setPhoto] = useState<ImageRecord | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [briefingNotes, setBriefingNotes] = useState(attendee.briefingNotes);
  const notesAutosave = useDebouncedAutosave<string>((value) =>
    saveAttendeeBriefingNotes(attendee.id, value),
  );

  useEffect(() => {
    let cancelled = false;
    void loadHistory(attendee).then((loaded) => {
      if (!cancelled) setHistory(loaded);
    });
    void getImage(attendee.id, "attendee-photo").then((stored) => {
      if (!cancelled) setPhoto(stored ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [attendee]);

  // The thumbnail is a data: URL over the stored bytes — the policy allows no blob:
  // images — recomputed only when the photo changes.
  const photoUrl = useMemo(
    () => (photo ? dataUrlOf(photo.bytes, photo.mediaType) : null),
    [photo],
  );

  const uploadPhoto = async (file: File) => {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const resized = await resizePhoto(file, canvasSurface());
      const stored = await putImage({
        ownerId: attendee.id,
        purpose: "attendee-photo",
        ...resized,
      });
      setPhoto(stored);
    } catch (cause) {
      setPhotoError(
        cause instanceof PhotoError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : String(cause),
      );
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await removeImage(attendee.id, "attendee-photo");
      setPhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  /** Pending briefing text lands before the view goes away. */
  const leave = async (then: () => void) => {
    await notesAutosave.flush();
    then();
  };

  /**
   * The confirmation says what goes with the record: the photo and the briefing notes
   * go; the notes captured about them and any drafts stay, attributed to nobody, and the
   * audit records are untouched (ADR-0008). A native confirm, because a second screen
   * for a rare action is more to learn than a question.
   */
  const remove = async () => {
    const confirmed = window.confirm(
      `Remove ${attendee.displayName} from this event?\n\nTheir photo and your briefing notes for them are removed. Notes captured about them and any drafts stay, attributed to nobody; audit records are not changed.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const dirty =
    edit.displayName !== attendee.displayName ||
    edit.kind !== attendee.kind ||
    edit.role !== attendee.role ||
    edit.specialty !== attendee.specialty ||
    edit.institution !== attendee.institution;

  const field = (key: keyof AttendeeEdit, value: string) => {
    setSaved(false);
    setEdit((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(edit);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const noteCount = history?.events.reduce((n, e) => n + e.notes.length, 0) ?? 0;
  const draftCount = history?.events.reduce((n, e) => n + e.drafts.length, 0) ?? 0;

  return (
    <section
      data-testid="attendee-view"
      data-attendee-id={attendee.id}
      aria-label={`Details for ${attendee.displayName}`}
      className="flex flex-col gap-4 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          data-testid="attendee-back"
          onClick={() => void leave(onBack)}
          className="min-h-11 rounded-lg border px-4 text-sm"
        >
          Back
        </button>
        <h2 className="truncate text-base font-semibold">{attendee.displayName}</h2>
      </div>

      <p data-testid="attendee-scope" className="text-xs opacity-70">
        This is what this phone holds about this person — what you typed, dictated, or
        imported. Nothing is looked up or fetched from anywhere.{" "}
        {SOURCE_LABELS[attendee.source][0]!.toUpperCase()}
        {SOURCE_LABELS[attendee.source].slice(1)}.
      </p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(submit) => {
          submit.preventDefault();
          if (dirty && !saving) void save();
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input
            data-testid="attendee-name"
            value={edit.displayName}
            onChange={(change) => field("displayName", change.target.value)}
            autoComplete="off"
            className="min-h-11 rounded-lg border px-3 text-base"
          />
          <span className="text-xs opacity-60">
            As it will appear in the greeting. Changing it applies to the next drafts;
            drafts already written keep the name they were written with.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Class</span>
          <select
            data-testid="attendee-kind"
            value={edit.kind}
            onChange={(change) => field("kind", change.target.value as AttendeeKind)}
            className="min-h-11 rounded-lg border px-3 text-base"
          >
            <option value="hcp">{KIND_LABELS.hcp}</option>
            <option value="staff">{KIND_LABELS.staff}</option>
          </select>
          <span className="text-xs opacity-60">
            Decides whether the model is told it is writing to a clinician or a colleague.
            It never sees the name either way.
          </span>
        </label>

        {(
          [
            ["role", "Role"],
            ["specialty", "Specialty"],
            ["institution", "Institution"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{label}</span>
            <input
              data-testid={`attendee-${key}`}
              value={edit[key]}
              onChange={(change) => field(key, change.target.value)}
              autoComplete="off"
              className="min-h-11 rounded-lg border px-3 text-base"
            />
          </label>
        ))}

        <div className="flex items-center justify-between gap-3">
          <p data-testid="attendee-save-state" className="text-xs opacity-60">
            {saving ? "Saving…" : saved ? "Saved" : dirty ? "Not saved yet" : ""}
          </p>
          <button
            type="submit"
            data-testid="attendee-save"
            disabled={!dirty || saving}
            className="min-h-11 rounded-lg border px-4 text-base font-medium disabled:opacity-40"
          >
            Save
          </button>
        </div>
        {error && (
          <p data-testid="attendee-error" role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Photo, for the briefing</h3>
        <p className="text-xs opacity-60">
          One you choose from this phone; nothing is looked up. Stored here as a small
          copy, and shown on the briefing document and nowhere else.
        </p>
        <div className="flex items-center gap-3">
          {photoUrl && photo ? (
            // A stored thumbnail from local bytes, not a remote image: `next/image` has no
            // place here and an <img> is the honest element.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-testid="attendee-photo"
              data-width={photo.width}
              data-height={photo.height}
              src={photoUrl}
              alt={`Photo of ${attendee.displayName}`}
              width={photo.width}
              height={photo.height}
              className="h-24 w-24 rounded-lg border border-black/10 object-cover dark:border-white/15"
            />
          ) : (
            <span
              data-testid="attendee-photo-none"
              className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-black/20 text-xs opacity-60 dark:border-white/25"
            >
              No photo
            </span>
          )}
          <div className="flex flex-col gap-2">
            <label className="min-h-11 cursor-pointer rounded-lg border px-4 py-2 text-sm">
              {photoBusy ? "Working…" : photo ? "Replace photo" : "Choose a photo"}
              <input
                ref={fileInput}
                data-testid="attendee-photo-input"
                type="file"
                accept="image/*"
                disabled={photoBusy}
                onChange={(change) => {
                  const file = change.target.files?.[0];
                  if (file) void uploadPhoto(file);
                }}
                className="sr-only"
              />
            </label>
            {photo && (
              <button
                type="button"
                data-testid="attendee-photo-remove"
                onClick={() => void removePhoto()}
                disabled={photoBusy}
                className="min-h-11 rounded-lg border px-4 text-sm"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
        {photoError && (
          <p
            data-testid="attendee-photo-error"
            role="alert"
            className="text-sm text-red-600"
          >
            {photoError}
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Briefing notes</span>
        <textarea
          data-testid="attendee-briefing-notes"
          value={briefingNotes}
          onChange={(change) => {
            setBriefingNotes(change.target.value);
            notesAutosave.schedule(change.target.value);
          }}
          placeholder="Your opener, your talking points — in your words."
          className="h-28 w-full resize-none rounded-lg border p-3 text-base leading-relaxed"
        />
        <span className="flex items-center justify-between text-xs opacity-60">
          <span>
            Goes on the briefing document, written by you. Never sent to the model. The
            notes below are not in the briefing.
          </span>
          <span data-testid="briefing-notes-state">
            {notesAutosave.state === "pending"
              ? "Saving…"
              : notesAutosave.state === "saved"
                ? "Saved"
                : notesAutosave.state === "error"
                  ? "Not saved"
                  : ""}
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          data-testid="attendee-delete"
          onClick={() => void remove()}
          disabled={deleting}
          className="min-h-11 self-start rounded-lg border border-red-600/40 px-4 text-sm text-red-700 disabled:opacity-40 dark:text-red-400"
        >
          {deleting ? "Removing…" : "Remove this person from the event"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">History on this phone</h3>
        {history === null ? (
          <p className="text-xs opacity-60">Loading…</p>
        ) : (
          <>
            <p data-testid="attendee-history-summary" className="text-xs opacity-60">
              {noteCount} note{noteCount === 1 ? "" : "s"} and {draftCount} draft
              {draftCount === 1 ? "" : "s"} across {history.events.length} event
              {history.events.length === 1 ? "" : "s"}. Events are joined by name, with
              titles ignored; a different spelling is a different person here.
            </p>
            <ul data-testid="attendee-history" className="flex flex-col gap-3">
              {history.events.map((entry) => (
                <li
                  key={entry.attendee.id}
                  data-testid="history-event"
                  className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15"
                >
                  <span className="font-medium">
                    {entry.event?.name ?? "An event since deleted"}
                    {entry.event?.startsAt
                      ? ` · ${formatDate(entry.event.startsAt)}`
                      : ""}
                    {entry.attendee.id !== attendee.id
                      ? ` · as “${entry.attendee.displayName}”`
                      : ""}
                  </span>
                  {entry.notes.length === 0 && entry.drafts.length === 0 && (
                    <span className="text-xs opacity-60">No notes or drafts.</span>
                  )}
                  {entry.notes.map((note) => (
                    <p
                      key={note.id}
                      data-testid="history-note"
                      className="whitespace-pre-wrap rounded border border-black/10 p-2 text-sm dark:border-white/15"
                    >
                      {note.body.trim() || "(empty note)"}
                    </p>
                  ))}
                  {entry.drafts.map((draft) => (
                    <button
                      key={draft.id}
                      type="button"
                      data-testid="history-draft"
                      data-state={draft.state}
                      onClick={() => void leave(() => onOpenDraft(draft))}
                      className="min-h-11 rounded-lg border px-3 text-left text-sm"
                    >
                      Draft · {DRAFT_STATE_LABELS[draft.state]} ·{" "}
                      {formatDate(draft.createdAt)}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
