# Session 10 — ADR-0009, the attendee view, and the clinician field

Written from a read-only printout of the repository taken 2026-09-14 after PR #41, and
checked again at the start of the session on `main` at `294d6c6`. One premise had a
planned correction built into it and is marked in the how-it-went section.

---

Session 10 — ADR-0009, the attendee view, and the clinician field. On `main` at
`294d6c6`. One PR, no follow-up pass: findings that are not blocking go in beads.

Read before starting: `CLAUDE.md`; `docs/HANDOFF.md`; plan §2, §3.2, and §4.1; ADR-0006
and ADR-0007; `src/lib/db/` in full; `classify()` in `src/lib/privacy/pseudonymize.ts`;
`src/components/capture/CaptureScreen.tsx`, `EventSwitcher.tsx`, and the review
components; `bd show fieldnote-1o6`, `fieldnote-g7d`.

## Why the session is shaped this way

The guide's session 10 entry is three nouns: photo upload, prior-interaction history,
suggested openers. The owner has decided the briefing's shape (ADR-0009 below), and that
decision removes one noun and moves another:

- **Suggested openers are withdrawn.** The model writes no part of the briefing; the
  representative types or dictates the opener herself. Not deferred — gone.
- **Photo upload moves to session 11**, with the PDF it exists for. It needs binary
  storage the cipher does not have, and that is a schema decision for the session that
  lays out the document.
- **Prior-interaction history** already exists as data keyed by `attendeeId`. This
  session renders it.

So this session is: the ADR written and its consequences applied, an attendee view, and
the structured clinician field `fieldnote-1o6` asks for.

## Part 1 — ADR-0009

Write `docs/adr/0009-briefing-is-downloaded-never-sent.md` from the owner's text below,
verbatim apart from formatting. Update the ADR index.

*(The owner's text is the ADR as committed: `docs/adr/0009-briefing-is-downloaded-never-sent.md`.)*

Then apply its consequences: a dated note on plan §3.2 (openers and talking points are
entered by the representative; positioning is private-fork-only); the guide's session 10
entry amended (openers withdrawn under ADR-0009, photo moved to 11, what this session
builds instead); the guide's session 11 entry amended (the form the representative
fills, photo upload and storage, no model); `fieldnote-g7d` updated (ADR written, the
remaining owed items are session 11's).

## Part 2 — The clinician field

`classify()` derives the token class from whether `specialty` is non-empty. Session 8
made `specialty` fillable from a sheet, so a "Department" column now decides whether the
model is told "a clinician" or "a colleague." Replace the heuristic with a field.

`AttendeeRecord.kind: "clinician" | "staff"`. Check plan §4.1 first for what it calls
the two token classes and use the plan's words if they differ. Schema v4, migration
backfilling from the old heuristic — non-empty `specialty` becomes `clinician`, else
`staff` — so nothing already stored changes class. Field policy `clear`, reason: an enum
with no identity in it, like `source`. `classify()` reads `kind` and nothing else; its
comment is rewritten, and the line calling a new field "a schema change for a cosmetic
difference" comes out, because session 8 made it not cosmetic.

Where `kind` comes from:
- The dock's add-person flow stays exactly as it is and writes `staff`. A person typed
  mid-event whose class is wrong gets corrected in the view. The dock grows no toggle.
- Import: a mapped title column of Dr or Prof sets `clinician`; otherwise `staff`. One
  sentence in the mapping step's copy says so. A merge never changes an existing `kind`.
- The view lets it be changed.

The migration gets a unit test against the fake database: a v3 attendee with a
specialty and one without, upgraded, land as `clinician` and `staff`. Session 8's PR
body claimed a migration test it did not have; this one has it.

## Part 3 — The attendee view

One person's record and what this device holds about them.

- The five fields — display name, kind, role, specialty, institution — editable, with
  `source` shown read-only as "added at the event" or "from a sheet". A display-name
  change is an ordinary update; a comment says the pseudonymizer builds its roster forms
  from `displayName` at generation time, so a rename applies to the next generation and
  touches no existing draft or audit record.
- Their notes across every event on this device, oldest first, with the event name.
- Their drafts across every event, with state, linking into the existing detail view.
- A line at the top saying this is what this device holds and nothing is fetched. Plan
  §2 names this profile as the second most serious issue in the project; the view should
  read like it knows that. No photo, no opener, no suggested anything.

Where it is reached from: your call, say why, respecting that the header layout is
validated — a third view toggle is a layout change; an option in a list that already
exists is not. The dock's attribution select and the follow-ups list both show a name;
one of those is probably the door.

## Scope guard

No photo. No opener. No briefing form. No change to the prompt template or the ruleset.
No change to the dock's add-person flow. No new dependency. Any change under
`src/lib/privacy/` runs the eval suite live on the PR; `classify()` is there, so expect
one run.

## Bookkeeping

Close `fieldnote-1o6`. Handoff regenerated from the template; changelog; prompt file
with a how-it-went section.

## Constraints

As every session: TypeScript strict; never `--no-verify`; `core.hooksPath` reads
`.husky/_` before the first commit and after every `bd` command; beads local; explicit
paths staged; separate commits per logical change — the ADR and its consequences are
their own commit before any code; merge commit. Prettier reformats on commit; anchor
edits on what is in the file. Write escapes, not literal control characters.

## Stop conditions

Stop and report if plan §4.1 contradicts the enum; if the migration cannot be tested
against the fake database; if the view needs a schema change beyond `kind`; or if a
premise here does not match the repository.

## Done when

ADR-0009 is committed with the index, plan, guide, and bead updated. `kind` is on every
attendee, backfilled, tested; `classify()` reads it alone; import sets it from the
title. The view renders a person's record and history and saves edits. The dock's tests
pass unchanged. Unit, e2e, and eval green on the PR.

## Report back

(1) Verified versus assumed. (2) The enum's names and what §4.1 said. (3) Where the view
lives and why. (4) What you built, file by file. (5) Beads, the guide and plan
amendments. (6) Flags last.

---

## How it actually went, for whoever reuses this

**The enum took the plan's words, as the prompt said to check.** Plan §4.1 names the two
token classes as HCP and staff — `[HCP_1]`, `[STAFF_2]` — and the tokenizer's `TokenKind`
says the same, so `Attendee.kind` is `"hcp" | "staff"`, not `"clinician" | "staff"`. The
prompt anticipated this. Every other premise held.

**"History keyed by `attendeeId`" is history within one event.** An attendee record
belongs to one event, so the same person met twice is two records with two ids. The
view joins them by canonical name — `canonicalNameOf`, titles stripped, case-insensitive
— which is the join the pseudonymizer itself uses to recognise a rostered person, and no
looser. The view states that the join is by name, because a join it did not state would
be a profile the reader could not audit. "Dr Vance" and "Dr. Peter Vance" are two people
to it; that is the stated limit, and the unit test holds it.

**The door is a third option in the event switcher**, "People at this event…", beside
"Start a new event…" and "Import a sign-in sheet…". The prompt guessed the dock's select
or the follow-ups list; neither works as a door — a `<select>` cannot hold a per-option
action without becoming something else, and the follow-ups list is a list of drafts. An
option in a list the representative already uses is not a change to the validated
header, which is the rule both earlier options followed.

**The migration test runs the registered migration's own `upgrade` function** over rows
written at v3, through a `table().toCollection().modify()` seam added to the fake
database. Session 8's PR claimed a migration test it did not have; this one is the shape.

**One mechanical trap, twice.** Prettier reformats on commit, and two edits anchored on
lines I had written failed to match after it wrapped them. The handoff's working notes
already say to anchor on what is in the file; the regex-tolerant replacement is the
practical form of that advice.

**The eval suite ran live on the PR**, because `classify()` is under `src/lib/privacy/`.
