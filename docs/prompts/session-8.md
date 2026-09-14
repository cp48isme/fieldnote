# Session 8 — Roster import

Written from a read-only printout of the repository taken 2026-09-14; checked again at the
start of the session, on `main` at `e09a0fa` after PR #40. One premise was wrong and is
marked in the how-it-went section at the end.

---

Session 8 — roster import. On `main` after PR #40 merges. One PR, no follow-up pass:
findings that are not blocking go in beads and the next session's prompt absorbs them.

Work from `docs/BUILD-GUIDE.md` session 8. It is short and nothing in it is stale, but
it says less than the repository now requires. Read before starting: `CLAUDE.md`;
`docs/HANDOFF.md`; ADR-0003 in full, especially the two consequences added 2026-09-01
and the residual-risk section; ADR-0006 and ADR-0007; `src/lib/db/` in full;
`src/lib/privacy/pseudonymize.ts`; `src/components/capture/CaptureDock.tsx` and the
`onAddAttendee` handler in `CaptureScreen.tsx`; `bd show fieldnote-g7d`, the walk-in
section; `bd show fieldnote-g6d`.

## What the guide does not say, verified 2026-09-14

- `read-excel-file` is already installed at `^9.3.10`. No dependency is added.
- `AttendeeRecord` has `displayName`, `role`, `specialty`, `institution`. No title
  field. Only `id`, `eventId`, `updatedAt` are indexed. The dock fills `displayName` only;
  the other three are empty strings on every attendee added at an event.
- The pseudonymizer has no fuzzy matcher and never will (ADR-0006: "Swali" → "Swelha"
  defeats any threshold that does not fire on prose). `canonicalNameOf` is
  module-private in `pseudonymize.ts` and is the one thing worth exporting.
- Any change under `src/lib/privacy/` runs the eval suite live on the PR. Exporting
  `canonicalNameOf` is such a change; that is fine, once.
- The greeting composes from `displayName` as entered, title included.

## When import happens, and what "fuzzy match against captured names" means

A sign-in sheet is produced at the event. So import can happen before (a registration
list) or after (the signed sheet), and in the second case the representative has already
added people through the dock during the event. The match is between imported rows and
attendees that already exist for the event. Design it that way: **the matcher proposes,
the representative confirms, and nothing merges silently.** An imported row that matches
an existing attendee fills that record's empty `role`, `specialty`, `institution` and
never overwrites `displayName`. An unmatched row becomes a new attendee. A match the
representative rejects becomes a new attendee too.

The matcher is new code. Compare canonical names — titles stripped via the exported
`canonicalNameOf` — with a conservative measure: exact on canonical, then surname-only,
then something like a bounded edit distance on the surname alone. Say what you chose and
why in the module header, and state the limit plainly: this will miss the Swali/Swelha
case by design, and the representative's confirmation is the control.

## The walk-in constraint

`fieldnote-g7d`'s note, and the owner's own observation: the roster is an intention,
not a record. Two things this session owes it.

**Adding a person mid-event stays exactly as easy as it is today.** The dock's add-person
flow is untouched. Import is a separate affordance, not a replacement.

**Record where each attendee came from.** Add `source: "captured" | "imported"` to
`AttendeeRecord`, following the precedent `NoteRecord.source` already sets. Schema v3,
migration, field-policy entry (`clear`; no identity in it). The reason to do it now
rather than later: session 11's briefing must say "expected attendance as of the date it
was generated," the review surface can tell a person who was met from one who was
listed, and ADR-0006's residual risk — a name with no title and no roster entry — gets
worse after import, so the record needs to say which entries were seen and which were
assumed. If you think this is the wrong session for a schema change, say so in the
report and don't do it; the field policy and migration are twenty minutes, the
argument for waiting would have to be better than that.

## Parsing, and the file never leaving the device

ADR-0003's residual risk is the operating rule: parsed output is hostile. Validate and
normalise every cell before it reaches Dexie — trim, length-cap, strip control characters,
reject anything that is not a string after coercion. Never pass parsed content into a
model call; it only reaches the model as an attendee's `displayName` or `role` through
the session 4 boundary, which is the existing path.

Three things ADR-0003 names that the guide does not:

- **`.xls` is detected and refused with an instruction** to re-save as `.xlsx`. Not a
  parse error that looks like a bug. Detect by the file's magic bytes, not the extension.
- **CSV is a separate entry point** in `read-excel-file`. Both formats import; the
  representative does not need to know they are handled differently.
- **Messy input.** Merged header cells, stray formatting rows above the header, a
  multi-row header, blank rows, trailing empty columns. Build the test fixture from
  these — a synthetic `.xlsx` committed under `tests/fixtures/`, with the synthetic
  roster's names and nothing else — and make "a messy real-shaped `.xlsx` imports
  correctly" mean that file.

**The file never touches the network** is demonstrated, not asserted. An e2e test that
imports the fixture with network requests recorded, and asserts none fired other than
same-origin asset loads. `tests/e2e/offline.spec.ts` already shows the pattern.

## Column mapping

Sign-in sheets never have consistent headers. The UI: show the detected header row,
let the representative pick which column is the name, which is the role, which is
specialty, which is institution, with a best guess pre-selected by header text
("Name", "Surname", "Title", "Department"). A title column, if mapped, is prepended to
the name when composing `displayName`, so the greeting keeps working. Keep it plain:
this is a form on a phone, not a spreadsheet editor.

ADR-0007: whatever the mapping writes into `role` is what the tokenizer's role pass
matches against. Say that in a comment where `role` is assigned.

## Where it lives

An import affordance from the event's setup or switcher — your call, say why — leading
to: file picker, header preview and column mapping, match review (proposed matches with
confirm/reject, unmatched rows listed as new), then a summary of what was added and what
was updated. No new route, no server involvement of any kind.

## Small things carried

`fieldnote-g6d`: add the one line to plan §5's data model noting `Note.attendeeId` is
nullable and why. Close it.

## Scope guard

No approved content library (9). No attendee photos or profiles (10) — `specialty` and
`institution` get filled from the sheet, nothing more. No briefing (11). No change to the
pseudonymizer beyond exporting `canonicalNameOf`. No new dependency. No new egress.

## Constraints

As every session: TypeScript strict; never `--no-verify`; `core.hooksPath` reads
`.husky/_` before the first commit and after every `bd` command; beads local, nothing
private in one; explicit paths staged; separate commits per logical change; merge commit.
Prettier reformats on commit — anchor edits on what is in the file.

Regenerate the handoff from the template last. Changelog entry. Prompt file with a
how-it-went section. Amend the guide's session 8 entry on completion.

## Stop conditions

Stop and report if: the messy fixture exposes behaviour in `read-excel-file` that cannot
be handled without a dependency; the matcher needs anything from the pseudonymizer
beyond one export; the eval suite fails on the PR; or a premise here does not match the
repository. Eight prompts running have been checked against a same-day printout; this
one was too, but check anyway.

## Done when

The messy fixture imports correctly through the mapping UI. `.xls` is refused with the
instruction. CSV imports through its own entry point. Matches are proposed and confirmed,
never silent. `source` is on every attendee, migration in place, v3. The e2e test shows
no network request during import. The dock's add-person flow is unchanged and its tests
still pass. `pnpm test`, `typecheck`, `lint`, `build`, e2e green; the eval suite green on
the PR.

## Report back

(1) Verified versus assumed. (2) The matcher: what it compares, what it misses, and the
counterfactual that shows it proposing rather than merging. (3) What the messy fixture
contains and what `read-excel-file` did with each artifact. (4) Where the import
affordance lives and why. (5) What you built, file by file. (6) Beads created or closed,
the guide amendment, the plan line. (7) Flags last.

---

## How it actually went, for whoever reuses this

**One premise was wrong, and it was the library's, repeated by three documents.** "CSV
is a separate entry point in `read-excel-file`" appears in ADR-0003 (2026-08-28), the
guide, and this prompt. At 9.3.10 the library has no CSV support at all: its exports are
`browser`, `node`, `universal`, and `web-worker`, and the two mentions of "csv" in its
source are about comma-separated values inside one cell. The stop condition names a
stale premise, but the resolution was unambiguous — a forty-line RFC 4180 reader with
no dependency, the thing ADR-0003's "no parser in-house" argument was never about — so
the session proceeded on that stated assumption and amended ADR-0003 with a dated note.
The reviewing instance's same-day printout did not catch this because nobody printed the
library's `package.json` exports; the next prompt that leans on a dependency's API should.

**What `read-excel-file` did with each artifact.** The banner, the blank rows, the
numeric column, and the trailing-space cell all arrived as expected and were handled by
the sanitiser and the header detector. The merged header cell arrived as its text in the
first column of the span and empty cells after it, exactly as ADR-0003's second
consequence warned, and the sub-label row was joined to it. **The two trailing empty
columns never arrived**: the library drops trailing empties before any code sees them,
so that artifact is handled by the library and the test moved the letter-naming check to
a column inside the used range.

**The matcher was wrong on the first end-to-end run.** In row order, "Dr Peter Vance" on
the row above "Marisol Vance" took her by surname, and her own row then had nobody left.
The fix settles every exact match across the whole sheet before any surname match is
tried, then close ones. A unit oracle holds the case.

**Decisions made in the session rather than read.** The import lives in the event
switcher beside "Start a new event…", because the header is the layout the
representative validated and a third button in it on a phone is a change to that layout;
an option in the list she already uses is not. Proposals have no default answer: the
import button stays disabled until every one has been answered, which is the strict
reading of "nothing merges silently" and costs a tap per proposal. A separate given-name
column is supported alongside the surname column, because "Surname" was in the prompt's
own example headers and sheets that split the name are common. A "Job title" header is a
role, not a salutation; the first guess got that wrong and the CSV fixture caught it.

**Two findings, in beads.** `fieldnote-1o6`: the pseudonymizer classifies an attendee as
HCP when `specialty` is non-empty, so an imported "Department" column can turn a
coordinator into a clinician token — the heuristic's stated cost, now reachable.
`fieldnote-6qr`: a workbook with several sheets reads the first only.

**The eval suite ran live on the PR**, because `canonicalNameOf` was exported from
`src/lib/privacy/`, as the prompt said it would.
