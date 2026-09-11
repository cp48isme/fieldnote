"use client";

/**
 * The capture screen. Holds the state, owns every call into the data layer, and passes
 * plain props down — the dock and the log render what they are given and nothing else.
 *
 * Everything here goes through `@/lib/db`. No module outside `src/lib/db/` imports Dexie,
 * and `tests/unit/db-boundary.test.ts` fails the build if one does.
 *
 * Three behaviours are worth reading before changing anything:
 *
 * **A note is created on the first save, not on arrival.** Opening the app does not write
 * an empty row, and neither does tapping into the textarea. The debounced save creates the
 * note if there isn't one, then writes the body. Without this the log fills with empty
 * notes from every time the app was opened and closed.
 *
 * **The most recent note is restored into the dock on load.** Reopening the app puts you
 * back where you were, mid-sentence, which is the whole point of the persistence work in
 * session 2. The alternative — always opening to a blank dock — is defensible and would
 * make an accidental append impossible, but it hides the half-finished note behind a tap
 * at exactly the moment someone is checking whether they lost it.
 *
 * **Attribution is state here, not on the note.** A note can be captured before anyone
 * knows whose it is (`NoteRecord.attendeeId` is nullable for that reason), so the dock's
 * selection is held here and applied at creation, or written through `attributeNote` when
 * the note already exists.
 *
 * **The review surface is a second view on the same layout, not a second screen.** The
 * header toggles between the notes (log above, dock below — the layout the
 * representative validated) and the follow-ups for the same event. Generation persists
 * every outcome as a draft beside its audit record in one write, per CLAUDE.md's
 * no-silent-generations agreement; opening a draft is what marks it reviewed; and export
 * copies to the clipboard and records that it did. Nothing here sends anything.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  attributeNote,
  createAttendee,
  createDraftWithAudit,
  createEvent,
  createNote,
  exportDraft,
  getActiveEventId,
  getAuditRecordForDraft,
  listAttendees,
  listAuditRecords,
  listDrafts,
  listEvents,
  listNotes,
  markReviewed,
  recordTouchedNote,
  saveDraftBody,
  saveNoteBody,
  setActiveEventId,
  type AttendeeRecord,
  type AuditRecordRecord,
  type DraftRecord,
  type EventRecord,
  type Id,
  type NoteRecord,
} from "@/lib/db";
import { generateDrafts } from "@/lib/generation/pipeline";
import { auditLogToCsv } from "@/lib/review/audit-csv";
import { useDebouncedAutosave } from "@/lib/useDebouncedAutosave";
import { useSessionLifecycle } from "@/lib/useSessionLifecycle";

import { DraftDetail } from "../review/DraftDetail";
import { FollowUps } from "../review/FollowUps";
import { BlockingNotice } from "./BlockingNotice";
import { CaptureDock } from "./CaptureDock";
import { EventSetup } from "./EventSetup";
import { EventSwitcher } from "./EventSwitcher";
import { NoteLog } from "./NoteLog";
import { RecoveryNotice } from "./RecoveryNotice";

export function CaptureScreen() {
  const [loaded, setLoaded] = useState(false);
  /**
   * Set when the data layer failed to open. Terminal: the screen is replaced rather than
   * shown with a warning, because every control on it writes to the store that just failed.
   */
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [event, setEvent] = useState<EventRecord | null>(null);
  /** True while the new-event form is up, so the dock cannot be typed into meanwhile. */
  const [startingNewEvent, setStartingNewEvent] = useState(false);
  const [attendees, setAttendees] = useState<AttendeeRecord[]>([]);
  /** Oldest first, as `listNotes` returns them. Reversed for display. */
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [activeNote, setActiveNote] = useState<NoteRecord | null>(null);
  const [attendeeId, setAttendeeId] = useState<Id | null>(null);
  const [body, setBody] = useState("");

  /** Which of the two views on this event is showing. */
  const [view, setView] = useState<"capture" | "review">("capture");
  /** Newest first, as `listDrafts` returns them. */
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  /** Edit distance by draft id, for the drafts that have been exported. */
  const [distances, setDistances] = useState<Map<Id, number>>(new Map());
  const [drafting, setDrafting] = useState(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  /** The draft open in the detail view, with its audit record, and the body being edited. */
  const [openDraft, setOpenDraft] = useState<DraftRecord | null>(null);
  const [openAudit, setOpenAudit] = useState<AuditRecordRecord | null>(null);
  const [draftBody, setDraftBody] = useState("");

  /**
   * In-flight `createNote`, so two saves racing on a brand-new note cannot each create
   * one. Cleared whenever the dock moves to a different note.
   */
  const creating = useRef<Promise<NoteRecord> | null>(null);

  const refreshNotes = useCallback(async (eventId: Id) => {
    setNotes(await listNotes(eventId));
  }, []);

  /**
   * The drafts for this event and, for the exported ones, their edit distances. One read
   * of the audit log rather than one per draft; the log is small and the read is local.
   */
  const refreshDrafts = useCallback(async (eventId: Id) => {
    const [list, records] = await Promise.all([listDrafts(eventId), listAuditRecords()]);
    const measured = new Map<Id, number>();
    for (const record of records) {
      if (record.eventId === eventId && record.editDistance !== null) {
        measured.set(record.draftId, record.editDistance);
      }
    }
    setDrafts(list);
    setDistances(measured);
  }, []);

  /**
   * The autosave target. `useDebouncedAutosave` re-reads this closure on every render, so
   * it always sees current state and needs no refs of its own.
   */
  const autosave = useDebouncedAutosave<string>(async (value) => {
    if (!event) return;

    let target = activeNote;
    if (!target) {
      // Created empty and written immediately below, rather than created with `value`.
      // Two saves racing on a brand-new note both await this one promise; if the body
      // were baked into creation, the second one's keystrokes would be dropped on the
      // floor. One extra write, once per note, buys that away.
      creating.current ??= createNote({ eventId: event.id, attendeeId });
      target = await creating.current;
      setActiveNote(target);
    }

    await saveNoteBody(target.id, value);
    await recordTouchedNote(target.id);
    await refreshNotes(event.id);
  });

  /**
   * Edits to an open draft, saved the same way notes are. The repository refuses the write
   * once the draft is exported or if it is blocked, and neither is reachable from the
   * editor, which is read-only after export and absent for a blocked draft.
   */
  const draftAutosave = useDebouncedAutosave<string>(async (value) => {
    if (!openDraft) return;
    await saveDraftBody(openDraft.id, value);
  });

  const session = useSessionLifecycle(
    useCallback(() => {
      void autosave.flush();
      void draftAutosave.flush();
    }, [autosave, draftAutosave]),
  );

  /**
   * Points the whole screen at an event: its people, its log, and the note that was open
   * in it. Shared by first load, switching, and creating, so all three land in the same
   * state — the restore-the-most-recent-note behaviour is a property of opening an event,
   * not something the load path does specially.
   */
  const openEvent = useCallback(
    async (target: EventRecord) => {
      const [people, captured] = await Promise.all([
        listAttendees(target.id),
        listNotes(target.id),
        refreshDrafts(target.id),
      ]);

      setEvent(target);
      setAttendees(people);
      setNotes(captured);
      setOpenDraft(null);
      setOpenAudit(null);
      setDraftNotice(null);

      const open = captured[captured.length - 1] ?? null;
      setActiveNote(open);
      setBody(open?.body ?? "");
      setAttendeeId(open?.attendeeId ?? null);
      setStartingNewEvent(false);
    },
    [refreshDrafts],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [all, activeId] = await Promise.all([listEvents(), getActiveEventId()]);
        if (cancelled) return;

        setEvents(all);
        // The stored choice wins. Falling back to the newest matters when the setting has
        // never been written, or points at an event that has since been deleted.
        const target =
          all.find((candidate) => candidate.id === activeId) ?? all[0] ?? null;
        if (target) await openEvent(target);
      } catch (cause) {
        // Reaching a terminal state is the point. Before this, a throw here left `loaded`
        // false for ever and the screen sat on "Loading…" with an unhandled rejection in a
        // console nobody is reading in a car park.
        if (cancelled) return;
        setLoadError(cause instanceof Error ? cause : new Error(String(cause)));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openEvent]);

  /**
   * Moves capture to a different event.
   *
   * The flush is first and is not optional: keystrokes still sitting in the debounce
   * belong to the note in the event being left. Clearing `creating` afterwards matters for
   * the same reason — it holds an in-flight `createNote` for the *previous* event, and a
   * later first keystroke would otherwise resolve to that promise and write into the wrong
   * event's note. Resetting `attendeeId` is the third: an attendee id from event A applied
   * to a note in event B is a cross-event reference the schema will happily store.
   *
   * `openEvent` resets all three of `activeNote`, `body`, and `attendeeId` from the target.
   */
  const switchEvent = useCallback(
    async (eventId: Id) => {
      const target = events.find((candidate) => candidate.id === eventId);
      if (!target || target.id === event?.id) return;

      await autosave.flush();
      creating.current = null;

      await setActiveEventId(target.id);
      await openEvent(target);
    },
    [autosave, event, events, openEvent],
  );

  const onCreateEvent = useCallback(
    async (name: string) => {
      // Same discipline as switching: anything pending belongs to the outgoing event.
      await autosave.flush();
      creating.current = null;

      try {
        const created = await createEvent({ name });
        setEvents(await listEvents());
        await setActiveEventId(created.id);
        await openEvent(created);
      } catch (cause) {
        // Same rule as the load path: a write that fails becomes something the user can
        // see, not an unhandled rejection.
        setLoadError(cause instanceof Error ? cause : new Error(String(cause)));
      }
    },
    [autosave, openEvent],
  );

  const onBodyChange = useCallback(
    (value: string) => {
      setBody(value);
      autosave.schedule(value);
    },
    [autosave],
  );

  /** Moves the dock to a different note — or to none — writing anything pending first. */
  const moveTo = useCallback(
    async (note: NoteRecord | null) => {
      await autosave.flush();
      creating.current = null;
      setActiveNote(note);
      setBody(note?.body ?? "");
      setAttendeeId(note?.attendeeId ?? null);
      if (event) await refreshNotes(event.id);
    },
    [autosave, event, refreshNotes],
  );

  const onAttributionChange = useCallback(
    async (next: Id | null) => {
      setAttendeeId(next);
      if (!activeNote || !event) return;
      const updated = await attributeNote(activeNote.id, next);
      setActiveNote(updated);
      await refreshNotes(event.id);
    },
    [activeNote, event, refreshNotes],
  );

  const onAddAttendee = useCallback(
    async (displayName: string) => {
      if (!event) return;
      const added = await createAttendee({ eventId: event.id, displayName });
      setAttendees(await listAttendees(event.id));
      // Attribute to the person just added: adding them here means this note is theirs.
      await onAttributionChange(added.id);
    },
    [event, onAttributionChange],
  );

  /**
   * Generation, from what is on screen, persisted as it lands. The flush first is the same
   * discipline as switching events: a note still sitting in the debounce is a note the
   * batch should see. Every outcome — drafted or withheld — becomes a draft beside its
   * audit record in one write; a withheld one persists with its reason and no body.
   */
  const onDraft = useCallback(async () => {
    if (!event || drafting) return;
    setDrafting(true);
    try {
      await autosave.flush();
      const [people, captured] = await Promise.all([
        listAttendees(event.id),
        listNotes(event.id),
      ]);
      const batch = await generateDrafts({ event, attendees: people, notes: captured });
      for (const outcome of batch.drafts) {
        await createDraftWithAudit({
          eventId: event.id,
          attendeeId: outcome.attendeeId,
          body: outcome.body,
          blocked: outcome.blocked,
          flagsFired: outcome.flagsFired,
          model: outcome.model,
          promptTemplateVersion: outcome.promptTemplateVersion,
          guardrailRulesetVersion: outcome.guardrailRulesetVersion,
          inputHash: outcome.inputHash,
          outputHash: outcome.outputHash,
        });
      }
      const count = batch.drafts.length;
      const skipped = batch.unattributedNotes;
      setDraftNotice(
        `${count} draft${count === 1 ? "" : "s"} written.` +
          (skipped > 0
            ? ` ${skipped} note${skipped === 1 ? "" : "s"} not yet attributed to anyone ${skipped === 1 ? "was" : "were"} left out.`
            : ""),
      );
      await refreshDrafts(event.id);
      setView("review");
    } catch (cause) {
      // A write that fails becomes something the user can see, not an unhandled rejection.
      setLoadError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setDrafting(false);
    }
  }, [autosave, drafting, event, refreshDrafts]);

  /**
   * Opening a draft is the act that marks it reviewed (plan §4.3). A `generated` draft
   * moves to `reviewed` here and nowhere else; any other state is opened as it is. A
   * blocked draft opens to its explanation and cannot move, because its state has no
   * outgoing transition.
   */
  const onOpenDraft = useCallback(async (draft: DraftRecord) => {
    const opened =
      draft.state === "generated"
        ? await markReviewed(draft.id)
        : { draft, audit: (await getAuditRecordForDraft(draft.id)) ?? null };
    setOpenDraft(opened.draft);
    setOpenAudit(opened.audit);
    setDraftBody(opened.draft.body);
  }, []);

  const onDraftBodyChange = useCallback(
    (value: string) => {
      setDraftBody(value);
      draftAutosave.schedule(value);
    },
    [draftAutosave],
  );

  const closeDraft = useCallback(async () => {
    await draftAutosave.flush();
    setOpenDraft(null);
    setOpenAudit(null);
    if (event) await refreshDrafts(event.id);
  }, [draftAutosave, event, refreshDrafts]);

  /**
   * Export: copy, then record. The clipboard write comes first because an export the
   * clipboard refused did not happen; the record is written only once the text is there.
   * If the record then fails, the error is shown and the draft stays `reviewed` — the
   * next attempt copies again and records.
   */
  const onExport = useCallback(async () => {
    if (!openDraft || !event) return;
    await draftAutosave.flush();
    await navigator.clipboard.writeText(draftBody);
    const result = await exportDraft(openDraft.id, draftBody);
    setOpenDraft(result.draft);
    setOpenAudit(result.audit);
    await refreshDrafts(event.id);
  }, [draftAutosave, draftBody, event, openDraft, refreshDrafts]);

  const onCopyAgain = useCallback(async () => {
    await navigator.clipboard.writeText(draftBody);
  }, [draftBody]);

  /**
   * The audit log, every record on this device, as a file. Ids and hashes only; see
   * `audit-csv.ts`. Built in memory and handed to the browser as a download, which is
   * the one way a file leaves this app, and it leaves to the user's own filesystem.
   */
  const onExportAuditLog = useCallback(async () => {
    const [records, all] = await Promise.all([listAuditRecords(), listEvents()]);
    const csv = auditLogToCsv(records, new Set(all.map((candidate) => candidate.id)));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fieldnote-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const toggleView = useCallback(async () => {
    if (view === "review") {
      await closeDraft();
      setView("capture");
    } else {
      await autosave.flush();
      setView("review");
    }
  }, [autosave, closeDraft, view]);

  const canDraft = notes.some(
    (note) => note.attendeeId !== null && note.body.trim() !== "",
  );

  const ready = loaded && session.ready;

  if (loadError) {
    return (
      <BlockingNotice
        testId="load-failed"
        title="Fieldnote could not open its local store"
        explanation="Nothing has been lost — notes already saved are still on this device — but capture cannot start until the store opens."
        action="Reload the page. If it happens again, the browser may be blocking storage for this site: check that it is not in private browsing and that site data is allowed."
        detail={loadError.message}
      />
    );
  }

  if (!ready) {
    return (
      <main className="flex h-[100dvh] items-center justify-center">
        <p data-testid="loading" className="text-sm opacity-60">
          Loading…
        </p>
      </main>
    );
  }

  return (
    // A dvh-sized column, so the log scrolls and the dock stays put when the software
    // keyboard opens. `min-h-0` on the scroller is what stops flexbox growing the column
    // past the viewport instead of scrolling inside it.
    <main className="flex h-[100dvh] flex-col">
      <header className="shrink-0 border-b border-black/10 px-4 py-3 dark:border-white/15">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {event ? (
            <EventSwitcher
              events={events}
              activeEventId={event.id}
              onSwitch={(eventId) => void switchEvent(eventId)}
              onStartNew={() => setStartingNewEvent(true)}
            />
          ) : (
            <h1 className="truncate text-base font-semibold">Fieldnote</h1>
          )}
          {event && (
            <div className="flex shrink-0 items-center gap-3">
              <p className="text-xs opacity-60">
                {/* The event name also lives here as text, so tests and screen readers have
                    something stable to read that is not the select's own value. */}
                <span data-testid="event-name-display" className="sr-only">
                  {event.name}
                </span>
                {notes.length} note{notes.length === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                data-testid="toggle-view"
                data-view={view}
                onClick={() => void toggleView()}
                className="min-h-11 rounded-lg border px-3 text-sm"
              >
                {view === "capture" ? `Follow-ups (${drafts.length})` : "Notes"}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl">
          {!session.recoveryAvailable && (
            <p
              data-testid="recovery-unavailable"
              role="status"
              className="mx-4 mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
            >
              Capture is working and your notes are saving. Crash recovery is not armed
              for this session, so if the app closes unexpectedly it will not be able to
              tell you what was open.
            </p>
          )}

          {session.recovered && (
            <RecoveryNotice
              recovered={session.recovered}
              onDismiss={() => void session.dismissRecovery()}
            />
          )}

          {(!event || startingNewEvent) && (
            <EventSetup
              onCreate={(name) => void onCreateEvent(name)}
              onCancel={event ? () => setStartingNewEvent(false) : undefined}
            />
          )}

          {event && !startingNewEvent && view === "capture" && (
            <NoteLog
              notes={[...notes].reverse()}
              attendees={attendees}
              activeNoteId={activeNote?.id ?? null}
              onOpenNote={(note) => void moveTo(note)}
            />
          )}

          {event && !startingNewEvent && view === "review" && !openDraft && (
            <FollowUps
              drafts={drafts}
              attendees={attendees}
              distances={distances}
              canDraft={canDraft}
              drafting={drafting}
              notice={draftNotice}
              onDraft={() => void onDraft()}
              onOpen={(draft) => void onOpenDraft(draft)}
              onExportAuditLog={() => void onExportAuditLog()}
            />
          )}

          {event && !startingNewEvent && view === "review" && openDraft && (
            <DraftDetail
              draft={openDraft}
              audit={openAudit}
              recipientName={
                attendees.find((a) => a.id === openDraft.attendeeId)?.displayName ??
                "Unknown recipient"
              }
              body={draftBody}
              onBodyChange={onDraftBodyChange}
              saveState={draftAutosave.state}
              onBack={() => void closeDraft()}
              onExport={onExport}
              onCopyAgain={onCopyAgain}
            />
          )}
        </div>
      </div>

      {event && !startingNewEvent && view === "capture" && (
        <CaptureDock
          body={body}
          onBodyChange={onBodyChange}
          attendees={attendees}
          attendeeId={attendeeId}
          onAttributionChange={(next) => void onAttributionChange(next)}
          onAddAttendee={(displayName) => void onAddAttendee(displayName)}
          onNewNote={() => void moveTo(null)}
          canStartNewNote={activeNote !== null || body.length > 0}
          saveState={autosave.state}
          saveError={autosave.error}
        />
      )}
    </main>
  );
}
