"use client";

/**
 * Roster import: a sign-in sheet or registration list into the event's attendees.
 *
 * Four steps on one screen, each replacing the last, because this is a form on a phone
 * and not a spreadsheet editor: pick the file; check the header and the column guesses;
 * review what the matcher proposes; read what happened. Every step can be cancelled and
 * nothing is written until the last button on the review step.
 *
 * WHERE IT SITS. Reached from the event switcher, beside "Start a new event…", so the
 * header the representative validated is unchanged and the dock's add-person flow is
 * untouched: import is a separate affordance, not a replacement (`fieldnote-g7d`).
 *
 * THE MATCHER PROPOSES, THE REPRESENTATIVE CONFIRMS, NOTHING MERGES SILENTLY. A row the
 * matcher pairs with an existing attendee is shown with both names and the basis, and
 * the representative chooses "same person" or "new person" for each. There is no
 * default: the import button stays disabled until every proposal has an answer, and a
 * proposal the representative never confirmed is imported as a new attendee. A confirmed
 * match fills the existing record's empty role, specialty, and institution and never its
 * display name — `applyRosterImport` cannot do otherwise.
 *
 * THE FILE NEVER LEAVES THE DEVICE. The browser hands the bytes to the parser; nothing
 * here fetches, posts, or opens a connection, and the end-to-end spec records every
 * request during an import to show that. `.xls` is refused by its magic bytes with an
 * instruction to re-save (ADR-0003), before any parser sees it.
 */

import { useState } from "react";

import {
  applyRosterImport,
  type AttendeeRecord,
  type EventRecord,
  type RosterImportDecision,
  type RosterImportResult,
} from "@/lib/db";
import { FORMAT_REFUSALS } from "@/lib/roster/format";
import {
  detectHeader,
  guessMapping,
  peopleFrom,
  ROSTER_FIELDS,
  type ColumnMapping,
  type DetectedHeader,
  type RosterField,
} from "@/lib/roster/header";
import { proposeMatches, type MatchProposal } from "@/lib/roster/match";
import { parseRosterFile, RosterFormatError } from "@/lib/roster/parse";

const FIELD_LABELS: Record<RosterField, string> = {
  name: "Name (or surname)",
  givenName: "First name, if separate",
  title: "Title (Dr, Mr…), if separate",
  role: "Role",
  specialty: "Specialty",
  institution: "Institution",
};

const BASIS_LABELS = {
  exact: "same name",
  surname: "same surname",
  close: "one letter apart",
} as const;

/** The `<select>` value for "not on this sheet". */
const UNMAPPED = "";

type Step =
  | { kind: "pick"; error: string | null }
  | { kind: "map"; rows: string[][]; header: DetectedHeader; mapping: ColumnMapping }
  | { kind: "review"; proposals: MatchProposal[]; answers: Map<number, "same" | "new"> }
  | { kind: "done"; result: RosterImportResult; error: string | null };

export interface RosterImportProps {
  event: EventRecord;
  attendees: AttendeeRecord[];
  /** Called after the import is applied; the caller re-reads the attendees. */
  onImported: (result: RosterImportResult) => void;
  onClose: () => void;
}

export function RosterImport({
  event,
  attendees,
  onImported,
  onClose,
}: RosterImportProps) {
  const [step, setStep] = useState<Step>({ kind: "pick", error: null });
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const { rows } = await parseRosterFile(file);
      const header = detectHeader(rows);
      if (!header) {
        setStep({
          kind: "pick",
          error:
            "No header row was found. The sheet needs a row of column names above the people.",
        });
        return;
      }
      setStep({ kind: "map", rows, header, mapping: guessMapping(header.columns) });
    } catch (cause) {
      const message =
        cause instanceof RosterFormatError
          ? FORMAT_REFUSALS[cause.format]
          : "The file could not be read. Export the sign-in sheet again as .xlsx or .csv and try once more.";
      setStep({ kind: "pick", error: message });
    } finally {
      setBusy(false);
    }
  };

  const toReview = (rows: string[][], header: DetectedHeader, mapping: ColumnMapping) => {
    const people = peopleFrom(rows, header, mapping);
    const proposals = proposeMatches(people, attendees);
    setStep({ kind: "review", proposals, answers: new Map() });
  };

  const applyImport = async (
    proposals: MatchProposal[],
    answers: Map<number, "same" | "new">,
  ) => {
    setBusy(true);
    try {
      const decisions: RosterImportDecision[] = proposals.map((proposal) => {
        const details = {
          role: proposal.person.role,
          specialty: proposal.person.specialty,
          institution: proposal.person.institution,
        };
        // Only a confirmed "same person" merges. No proposal, or any other answer, is new.
        if (proposal.candidate && answers.get(proposal.person.row) === "same") {
          return { kind: "merge", attendeeId: proposal.candidate.id, details };
        }
        return { kind: "new", displayName: proposal.person.displayName, details };
      });
      const result = await applyRosterImport(event.id, decisions);
      setStep({ kind: "done", result, error: null });
      onImported(result);
    } catch (cause) {
      setStep({
        kind: "done",
        result: { added: [], updated: [] },
        error: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      data-testid="roster-import"
      data-step={step.kind}
      aria-label="Import a sign-in sheet"
      className="flex flex-col gap-4 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Import a sign-in sheet</h2>
        <button
          type="button"
          data-testid="roster-close"
          onClick={onClose}
          className="min-h-11 rounded-lg border px-4 text-sm"
        >
          {step.kind === "done" ? "Done" : "Cancel"}
        </button>
      </div>

      {step.kind === "pick" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm opacity-80">
            An Excel (.xlsx) or CSV file. It is read on this phone and never uploaded.
            People already added at the event are matched by name for you to confirm.
          </p>
          <label htmlFor="roster-file" className="text-sm font-medium">
            Choose the file
          </label>
          <input
            id="roster-file"
            data-testid="roster-file"
            type="file"
            accept=".xlsx,.csv,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            disabled={busy}
            onChange={(change) => void onFile(change.target.files?.[0])}
            className="min-h-11 text-base"
          />
          {step.error && (
            <p
              data-testid="roster-error"
              role="alert"
              className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
            >
              {step.error}
            </p>
          )}
        </div>
      )}

      {step.kind === "map" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm opacity-80">
            These are the column names found on the sheet. Check which is which; only the
            name is needed.
          </p>
          <ul data-testid="roster-columns" className="flex flex-wrap gap-2 text-xs">
            {step.header.columns.map((label, c) => (
              <li key={c} className="rounded border px-2 py-1">
                {label}
              </li>
            ))}
          </ul>
          {ROSTER_FIELDS.map((field) => (
            <label
              key={field}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span>{FIELD_LABELS[field]}</span>
              <select
                data-testid={`roster-map-${field}`}
                value={step.mapping[field] ?? UNMAPPED}
                onChange={(change) =>
                  setStep({
                    ...step,
                    mapping: {
                      ...step.mapping,
                      [field]:
                        change.target.value === UNMAPPED
                          ? null
                          : Number(change.target.value),
                    },
                  })
                }
                className="min-h-11 max-w-[55%] rounded-lg border px-2 text-base"
              >
                <option value={UNMAPPED}>Not on this sheet</option>
                {step.header.columns.map((label, c) => (
                  <option key={c} value={c}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            type="button"
            data-testid="roster-to-review"
            disabled={step.mapping.name === null}
            onClick={() => toReview(step.rows, step.header, step.mapping)}
            className="min-h-11 rounded-lg border px-4 text-base font-medium disabled:opacity-40"
          >
            Next: check the people
          </button>
        </div>
      )}

      {step.kind === "review" && (
        <ReviewStep
          proposals={step.proposals}
          answers={step.answers}
          busy={busy}
          onAnswer={(row, answer) => {
            const answers = new Map(step.answers);
            answers.set(row, answer);
            setStep({ ...step, answers });
          }}
          onImport={() => void applyImport(step.proposals, step.answers)}
        />
      )}

      {step.kind === "done" && (
        <div className="flex flex-col gap-2">
          {step.error ? (
            <p data-testid="roster-error" role="alert" className="text-sm text-red-600">
              Nothing was imported: {step.error}
            </p>
          ) : (
            <p data-testid="roster-summary" role="status" className="text-sm">
              Added {step.result.added.length}, updated {step.result.updated.length}.
              People added here are marked as imported from the sheet; anyone you add from
              the note dock is still marked as met.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

interface ReviewStepProps {
  proposals: MatchProposal[];
  answers: Map<number, "same" | "new">;
  busy: boolean;
  onAnswer: (row: number, answer: "same" | "new") => void;
  onImport: () => void;
}

function ReviewStep({ proposals, answers, busy, onAnswer, onImport }: ReviewStepProps) {
  const proposed = proposals.filter((p) => p.candidate !== null);
  const unanswered = proposed.filter((p) => !answers.has(p.person.row));
  const fresh = proposals.filter((p) => p.candidate === null);

  return (
    <div className="flex flex-col gap-3">
      {proposed.length > 0 && (
        <>
          <p className="text-sm opacity-80">
            These rows look like people already added at the event. Confirm each one;
            nothing is merged until you do.
          </p>
          <ul className="flex flex-col gap-2">
            {proposed.map((p) => (
              <li
                key={p.person.row}
                data-testid="roster-proposal"
                data-row={p.person.row}
                data-answer={answers.get(p.person.row) ?? "unanswered"}
                className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15"
              >
                <span>
                  <span className="font-medium">{p.person.displayName}</span> on the sheet
                  — <span className="font-medium">{p.candidate!.displayName}</span> at the
                  event ({BASIS_LABELS[p.basis!]})
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    data-testid="roster-same"
                    onClick={() => onAnswer(p.person.row, "same")}
                    className={`min-h-11 flex-1 rounded-lg border px-3 ${answers.get(p.person.row) === "same" ? "border-sky-500 bg-sky-500/10" : ""}`}
                  >
                    Same person
                  </button>
                  <button
                    type="button"
                    data-testid="roster-new"
                    onClick={() => onAnswer(p.person.row, "new")}
                    className={`min-h-11 flex-1 rounded-lg border px-3 ${answers.get(p.person.row) === "new" ? "border-sky-500 bg-sky-500/10" : ""}`}
                  >
                    New person
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-sm opacity-80">
        {fresh.length} {fresh.length === 1 ? "person" : "people"} will be added as new
        {proposed.length > 0 ? ", plus any above you mark as new" : ""}.
      </p>
      <ul data-testid="roster-new-list" className="flex flex-col gap-1 text-sm">
        {fresh.map((p) => (
          <li key={p.person.row} data-testid="roster-new-row">
            {p.person.displayName}
            {p.person.role ? ` — ${p.person.role}` : ""}
          </li>
        ))}
      </ul>

      <button
        type="button"
        data-testid="roster-apply"
        disabled={busy || unanswered.length > 0 || proposals.length === 0}
        onClick={onImport}
        className="min-h-11 rounded-lg border px-4 text-base font-medium disabled:opacity-40"
      >
        {unanswered.length > 0
          ? `Answer ${unanswered.length} more to import`
          : `Import ${proposals.length} ${proposals.length === 1 ? "person" : "people"}`}
      </button>
    </div>
  );
}
