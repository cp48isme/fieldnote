# Session 16 — Data protection assessment

**Process note.** This prompt was drafted by the session 15 instance, after that session
closed, and then rewritten by Guardian, the separate instance with no view of the
repository. As with session 15, the premises were written twice. One of them was wrong in
a way both writers shared, because it came from the tracker rather than from either of
them; the "how it actually went" section has it. Two lines below are replaced with
`[redacted — would expose private material]`: each names the mechanism by which the
tracker once published, and the `CLAUDE.md` agreement keeps that out of every location
this repository controls. The owner has the full text.

---

Session 16 — the data protection assessment. On `main` at `5d669b0`, after PR #49.
The second document of Phase 4.

## Ground rules
- One branch, `docs/session-16-data-protection`. Local commits only. Do not push, do
  not open a PR, do not merge. The owner's reviewer reads the branch before anything
  reaches the remote.
- The rule on the private material binds every artifact this session writes: the
  document, bead close reasons and notes, commit messages, the handoff, the changelog,
  the guide, and the prompt file. Public artifacts say only that a term held out of the
  public documents was exposed for a day in 2026-09 and that a history the project does
  not control retains it. No host, no URL, no remote, no ref, no retention mechanism,
  no description of how the tracker published, no pointer to a commit that holds the
  inventory. Cite `docs/THREAT-MODEL.md` §5.5 and §6; do not paraphrase them.
- Stops means stops. If a stop condition is met, write the report and wait.

## Read before starting
`CLAUDE.md`; `docs/HANDOFF.md`; the guide's session 16 entry in full, and the session
17 and 18 entries for what this document must hand them; plan §2 (the four exposures),
§4.1 (what crosses the one egress), §4.6 (the row for `docs/DATA-PROTECTION.md`, and
precise rather than expansive), and §8; `docs/THREAT-MODEL.md` in full — §2 is the flow
this document draws, §3.3's first column is the inventory of what crosses, §6 is the
residual-risk list this document cites and does not restate; `SECURITY.md`; ADR-0001,
ADR-0004 (the threat table, *Residual risk*, and the retention consequence as amended),
ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009.

Beads, with `bd show`, so every citation is verified rather than copied from this
prompt: `fieldnote-d7d`; `fieldnote-tcq` with its notes (closed, the retention
decision); `fieldnote-iox` (its implementation); `fieldnote-bdw` with its notes;
`fieldnote-jqk`, `fieldnote-52s`, `fieldnote-5ow`, `fieldnote-tg4`, `fieldnote-8w6`,
`fieldnote-ap1`; `fieldnote-3rl`, `fieldnote-n9l`, `fieldnote-9n1`, `fieldnote-bn0`;
`fieldnote-ao9`; `fieldnote-ijg`, `fieldnote-v2s`.

Code: `src/lib/db/schema.ts` (every field's classification and `why`);
`src/lib/db/repository.ts` (`deleteEvent`, `deleteAttendee`, the header);
`src/app/api/generate/route.ts` (the request schema); `src/lib/images/resize.ts`;
`src/lib/roster/sanitize.ts`; `src/lib/review/audit-csv.ts`; and the tests each entry
below cites.

## Part 1 — The document

`docs/DATA-PROTECTION.md`, written by hand, in the register of the ADRs and the threat
model: plain, specific, honest about what is not held. A DPIA-style assessment of the
public build as a design. The private fork's deployment is named as the thing it does
not assess. Its shape:

1. **Purpose and scope.** What the system is for, in one paragraph. The data subjects:
   attendees who are healthcare professionals, attendees who are staff, contacts, and
   the representative herself. The public build holds synthetic data; this assesses the
   design the private fork will run; plan §2's organisational review is a precondition
   of any deployment and this document does not stand in for it.

2. **Data inventory.** One table per store, derived from `src/lib/db/schema.ts`: the
   eleven tables in `TABLES`, every field with its classification and the schema's own
   `why`. Do not re-classify anything; where a classification looks wrong, that is a
   stop, not an edit. `fieldnote-ao9` already records one classification to revisit;
   cite it at that field. Photographs and site maps: state the facts — an identifiable
   image of a person, resized on the device (512 pixels JPEG; site maps 1600 pixels PNG,
   `src/lib/images/resize.ts`), stored as bytes, not processed for recognition. Do not
   characterise them under any law.

3. **Flows.** Text diagrams in the style of `docs/THREAT-MODEL.md` §2;
   `ARCHITECTURE.md` (session 18) owns the drawn ones. Each flow: what enters, what is
   stored, what leaves, by whose action.
   - Capture, typed and dictated (ADR-0005). The platform's dictation processes speech
     before the app receives text; where that happens is unrecorded (`fieldnote-8w6`)
     and the flow says so.
   - Roster import (session 8).
   - Generation: the request the route validates, field by field, and the response;
     the fields that cross outside the note delimiter (`fieldnote-3rl`).
   - The hand exports: clipboard (`fieldnote-bn0`), briefing PDF (ADR-0009), calendar
     file, site map, audit CSV. Each is the representative's own action into her own
     applications; none is a network egress.
   - Deletion: what `deleteEvent` cascades to (five tables) and spares (audit records),
     and what `deleteAttendee` takes (the attendee and their images) and leaves (their
     notes and drafts).
   - The platform's copies: whether the installed app's storage is included in a
     device or cloud backup is unrecorded (`fieldnote-ap1`), and the flow says so.

4. **Retention.** Part 4 below.

5. **Minimisation.** Part 3 below.

6. **Rights and their limits.** State what the design can do today, plainly:
   - Deleting an event removes that event's attendees, notes, drafts, contacts, and
     images. Cite the code (`repository.ts`), and say exactly what the test proves: the
     test at `tests/unit/repository-drafts.test.ts:230` asserts that drafts go and audit
     records stay, and not the other four tables (`fieldnote-52s`). ADR-0008's decision
     statement names three tables where the code cascades five (`fieldnote-5ow`).
   - A request concerning one attendee cannot be fully met without deleting the whole
     event: removing the attendee leaves their notes and drafts (`fieldnote-jqk`, an
     open owner decision).
   - Audit records are not deleted by any action (ADR-0008). They hold hashes and
     metadata, not content. A deletion request is met for content and stated plainly as
     not met for the hash-only record.
   - Say whether a hash of pseudonymized text relates to an identifiable person as a
     fact about what it can and cannot be matched against. Do not characterise it
     legally; session 17 does that.

7. **Processors and third parties.** In the public build, one: the model provider,
   receiving the pseudonymized request — what it receives (§3.3's first column), what
   it does not (identity), and what is not verified (`fieldnote-n9l`). The platform's
   dictation and backup, as unverified (`fieldnote-8w6`, `fieldnote-ap1`). Hosting the
   private fork would add at least one more (`fieldnote-ijg`), which this document does
   not assess. No analytics, telemetry, error reporting, or CDN; cite the threat
   model's cells that name the controls.

8. **Residual risk.** Cite `docs/THREAT-MODEL.md` §6 by item. Add only what has a bead
   and is data-protection specific and not already in §6 — for example eviction on the
   availability axis (`fieldnote-bdw`) and the attendee-removal limit
   (`fieldnote-jqk`). Anything with no bead is a finding: stop.

## Part 2 — What this document is precise about

Plan §4.6: precise rather than expansive. This document does not claim a legal basis, a
jurisdiction, a lawful-processing ground, a special category, or a risk tier. Session
17's compliance map does that work against named frameworks; this document hands it the
facts. Where a sentence would need a lawyer to be true, write the fact the lawyer would
need instead. Every sentence about real data subjects is a sentence about the private
fork, and says so.

## Part 3 — Minimisation, as decisions with files behind them

Each item: the decision, its record, and the file that enforces it — or the words "not
enforced; documented". Verify each before writing it; a mismatch is a stop.

- Identity does not cross the egress: ADR-0006, ADR-0007;
  `tests/unit/pseudonymize.test.ts`, `tests/unit/pipeline.test.ts`.
- No audio, no transcription service, no microphone permission: ADR-0005;
  `microphone=()` asserted at `tests/e2e/headers.spec.ts:30`.
- Contacts never reach the generation layer: `tests/unit/contacts-boundary.test.ts`.
- The audit record holds hashes and metadata, never content: ADR-0008;
  `src/lib/review/audit-csv.ts`'s eighteen columns. The CSV test at
  `tests/unit/audit-csv.test.ts:45` asserts column values, not the absence of names
  (`fieldnote-tg4`); say so.
- The route logs metadata only: `tests/unit/generate-route.test.ts`.
- Roster cells are cleaned and cut to 120 characters: `MAX_CELL_LENGTH`,
  `src/lib/roster/sanitize.ts:15`, applied at :29. No test asserts the cap
  (`fieldnote-tg4`): not enforced by a test; documented.
- Photographs are resized on the device: `src/lib/images/resize.ts`. A size decision,
  not a minimisation of what a photograph is.
- No server-side store: by construction — `tests/unit/db-boundary.test.ts` (Dexie only
  in the data layer) and `tests/unit/single-egress.test.ts` (one destination) — and
  `SECURITY.md`. No test asserts the absence; say so.
- What is not minimised, as plainly: the event name and passages
  (`fieldnote-3rl`); the provider's retention (`fieldnote-n9l`); audit records growing
  without limit, by decision.

## Part 4 — Retention, as decided and not yet built

The owner decided retention on 2026-09-16; the decision is in `fieldnote-tcq`'s notes.
Write it from those notes: scope, the due point and its fallbacks, prompted with a
ceiling and a warning before it, audit records kept, periods as build-time constants
the private fork may change. Quote the periods as the notes state them.

Then state, plainly:
- It is **not yet implemented** (`fieldnote-iox`). Nothing in `src/` deletes by age or
  schedule today. Until `fieldnote-iox` closes, the store is not bounded, and ADR-0004's
  reliance on a small store is a decided policy, not a present property.
- Audit records grow without limit by decision (ADR-0008, `fieldnote-tcq`).
- Retention and eviction are different questions. Eviction may delete sooner, on the
  platform's schedule, and bears on whether data leaves the device before it is lost
  (`fieldnote-bdw`, still open). The app does not request persistent storage today.
- Nothing records that an audit CSV export has been taken.

What this document must not assume: that the store is small today; that anything
deletes on a schedule today; that eviction protects or threatens the data; that an
export has ever been taken from a real device.

## Scope guard
No new ADR (the retention ADR belongs to `fieldnote-iox`). No change to the schema,
migrations, repository, route, prompt, ruleset, pseudonymizer, denylist, any test, or
any workflow. Do not fix what `fieldnote-52s`, `fieldnote-5ow`, `fieldnote-tg4`, or
`fieldnote-jqk` record: cite them. No retention implementation. No generated diagram,
no dependency. No `COMPLIANCE-MAP.md` or `ARCHITECTURE.md`: end the document with a
short paragraph on what each will need from it. The eval gate should skip: nothing
under a watched path changes.

## Bookkeeping
Before any bead command, verify beads stay local, by doing, and repeat after the last
one; check `core.hooksPath` is `.husky/_`. That output goes in the report only.
The only bead writes: set `fieldnote-d7d` to open, then close it with a reason naming
the document. No other bead is created, updated, or closed. Guide session 16 amended on
completion. Plan §4.6's row unchanged. No ADR amended. Handoff regenerated from the
template; changelog line; `docs/prompts/session-16.md` with how-it-went, and the process
note that this prompt was drafted by the session 15 instance and rewritten by Guardian.

## Stop conditions
Stop if a premise here does not match the repository or the tracker, including any file
line, test name, bead id, or count this prompt names. Stop if a section cannot be
written without describing the private material. Stop if a classification in the schema
looks wrong. Stop if the session finds a live weakness or a data flow not already
recorded in a bead or ADR: describe it in the report only; open nothing, commit nothing
describing it, and do not continue.

## Done when
`docs/DATA-PROTECTION.md` exists in the shape above; the inventory matches the schema
field for field with nothing re-classified; each flow says what enters, what is
stored, what leaves, and by whose action; the platform's dictation and backup appear as
unverified; minimisation lists each decision with its file or "documented"; retention is
written from the decision as not yet implemented; the rights section states the
attendee-removal limit, the audit-record exception, and what the cascade test does and
does not prove; no legal characterisation anywhere; residual risk cites §6 and adds
only bead-backed items; unit and e2e green; the eval gate would skip (read
`scripts/evals-watched-paths.mjs` against the diff); `fieldnote-d7d` closed; all local.

## Report back — raw output, not summaries
Anything that would contain the private term, or say where it sat, is replaced with
"[redacted — would expose private material]" and the command named.
1. Verified versus assumed.
2. The inventory's table count and per-table field count against `schema.ts`, so a
   missed field shows.
3. Each flow in one sentence.
4. The minimisation list, each item with its file or "documented".
5. The retention section in full.
6. The rights section in full.
7. Every sentence in the document that uses any of: lawful, legal basis, special
   category, biometric, personal data, controller, processor, jurisdiction, GDPR, HIPAA.
   Paste each with its line. Expected: few or none, and each a fact, not a
   characterisation.
8. `docs/DATA-PROTECTION.md` in full.
9. Beads: the local-only checks before and after, `core.hooksPath` after,
   `bd show fieldnote-d7d` after.
10. `git log --format='%H%n%B' main..HEAD`; `git diff --stat main`; `git status`.
11. The watched-path check against the diff.
12. Unit and e2e counts.
13. The local denylist over the diff and commit messages, match counts only; and
    `grep -n -i -E '[redacted — would expose private material]'`
    over every changed file and the commit messages, every hit pasted.
14. `git rev-parse HEAD` and confirmation nothing was pushed (no remote branch of
    that name: `git ls-remote --heads origin docs/session-16-data-protection`, empty).
15. Anything that met a stop condition. This time, stop.

---

## Additions sent mid-session

The session stopped on the first pass (see below) and the owner answered the stop with
the following, after which it resumed. Between the two, the owner also asked, as a
separate task, for one device observation to be appended to `fieldnote-bdw` and one
bead to be opened for an installed-app failure seen the same day; items A5 and A6 below
repeat those two writes and were skipped as already done.

Session 16 — the owner's answers to your stop. Then resume.

The stop was correct. The fieldnote-tg4 premise came from a fact-finding run whose
output was cut at ten lines; line 53 was missed.

### A. Tracker writes first
These, plus fieldnote-d7d at the end, are the only bead writes this session makes.
Run the local-only checks before the first and after the last, as in the session
prompt. Use --append-notes; never overwrite notes.

1. fieldnote-tg4. Retitle: "The audit CSV test is named for more than it asserts".
   Append, dated 2026-09-16: "Correction: item 2 was wrong and is withdrawn. The
   120-character cap is asserted at tests/unit/roster-csv.test.ts:53
   (`cleanCell("x".repeat(500))` has length 120), added in 1b6d071 on 2026-09-14. The
   earlier check cut its output at ten lines and missed it. Item 1 stands."

2. fieldnote-ao9. Append, dated: "ApprovedContent.label and sourceRef are clear on the
   same grounds as body, and the fingerprint concern applies to all three; the session
   19 revisit covers them."

3. Open a P2 bead, type decision, labels governance: "No action deletes a single note
   or a single draft". Description: the facts as you found them — the repository's
   delete and remove exports (list them), that none takes a note or a draft, that a
   note body can be edited to empty, and that only deleteEvent removes notes and
   drafts. Consequence for the data-protection assessment: a request concerning one
   note or one draft cannot be met without deleting the whole event. Whether to add
   such an action is an owner decision; this bead records the question. Relates to
   fieldnote-jqk.

4. Search the tracker for an existing bead on persistence.spec.ts:92. If one exists,
   append this occurrence. If none, open a P2 task, labels test: "persistence.spec.ts:92
   fails intermittently in full-suite runs". Description: failed in a full run on
   2026-09-15 and again on 2026-09-16, on unchanged code, passing on an isolated re-run
   both times; the failure is the recovered-session banner still visible after dismiss
   (line 120). Closes with the cause found and the test or the code fixed. No fix now.

5. Append to fieldnote-bdw, dated 2026-09-16, as the owner's observation:
   "Device result, observed by the owner. The Fieldnote app, installed to the home
   screen on 2026-09-08, was not opened again until 2026-09-16: eight days. On opening,
   all notes captured on 2026-09-08 were present and the app worked. iOS 26.6.1. One
   device, one run. What this shows: storage survived an eight-day idle window for the
   installed app. What it does not show: behaviour under storage pressure, what
   navigator.storage.persisted() reports, or which protection held. The app was opened
   with the Mac's HTTPS server running, but the notes are stored on the device, so
   their presence is the result. The 2026-09-08 note's missing iOS version is 26.6.1."
   Do not close fieldnote-bdw.

6. Open a P2 bead, type task, labels pwa,ios: "The installed app shows the HTTPS
   proxy's error page instead of its offline copy when the proxy is up and the app
   server is not". Description: "On 2026-09-16, with `pnpm serve:https` on port 3443 and
   nothing on port 3000, the installed app on iOS 26.6.1 displayed 'Cannot reach the app
   on http://127.0.0.1:3000' rather than opening from its stored copy. Starting the app
   server fixed it and all stored notes were present. Likely cause, unconfirmed: the
   service worker falls back to its cached shell only on a network failure, and the
   proxy (scripts/serve-https.mjs) answers with an error response. Closes with the
   service worker's fetch handling and the proxy's response read, the cause confirmed
   or corrected, and a decision on whether an error response from the origin should
   fall back to the stored shell. No fix now."

### B. Amendments to the session prompt
- Minimisation, roster cells: enforced by `tests/unit/roster-csv.test.ts:53`. No
  fieldnote-tg4 citation there.
- Minimisation, audit CSV: still cite fieldnote-tg4, for the name-absence gap.
- Rights: add that no action deletes a single note or a single draft, citing the new
  bead from A3.
- Inventory: cite fieldnote-ao9 at ApprovedContent's label, body, and sourceRef.
- What crosses the egress: cite `docs/THREAT-MODEL.md` §2's paragraph on the one egress
  and the §3.3 rows, not "§3.3's first column".
- Eviction and durability: fieldnote-bdw now carries one device observation. State it
  with its limits: one device, one run, iOS 26.6.1, eight idle days; storage pressure
  and persisted() unobserved. The threat model's §6 still says unverified. Do not amend
  it; this document records the later observation and cites the bead. The platform
  unknowns remain as the prompt says.
- Tests: "e2e green" means a full run green. If the only failure is
  persistence.spec.ts:92 and it passes on an isolated re-run, record both runs and cite
  the bead from A4. Any other failure is a stop.

### C. Resume
Then start Part 1 as written, with the amendments in B. Every other rule is unchanged:
local commits only, no push, stops means stops.

Report back as the session prompt specifies, with one item added at the start: the
local-only checks around the tracker writes; `bd show` in full for each new bead, and
the new notes only for fieldnote-tg4, fieldnote-ao9, and fieldnote-bdw; and the retitle.

---

## How it actually went, for whoever reuses this

**One premise did not hold, and the session stopped on it before writing anything.**
Part 3 says no test asserts the roster cell cap, citing `fieldnote-tg4`. The repository
has one: `tests/unit/roster-csv.test.ts:53` asserts that a 500-character cell comes out
120 long, and it had since commit `1b6d071` on 2026-09-14, two days before the bead was
opened. The bead's second item was wrong and the prompt had copied it. Both writers of
this prompt shared the error because neither wrote it: it came from a fact-finding run
whose output was cut at ten lines, and line 53 was below the cut. The session wrote the
report, created no branch, touched no bead, and waited. The owner corrected the bead, the
prompt, and the minimisation entry, and the session resumed. This is the second session
in a row to meet a stop condition, and the first to stop on it.

**Every other premise held.** `main` at `5d669b0` with #49 merged; every bead cited
existed with the notes the prompt described; every file line, test name, count, and
cascade the prompt named was where and what it said; eleven tables; eighteen CSV
columns; five cascaded tables and one spared; 512 and 1600 pixels.

**Two other things the session noticed and put to the owner rather than deciding.** No
action deletes a single note or a single draft — the same class as `fieldnote-jqk` — and
the owner opened `fieldnote-cdx` for it and had the document state it. And
`ApprovedContent.label` and `sourceRef` share `body`'s classification and `fieldnote-ao9`'s
concern; the owner appended that to the bead and had the document cite it at all three
fields.

**One fact the flows state that nothing had written down.** `NoteRecord.source` exists to
say whether text was typed or dictated; the one caller of `createNote` passes no source,
so every note is written as `typed`, because the application cannot tell (ADR-0005).
Stated in the inventory; no bead, because it is what the schema and the ADR already
imply.

**The e2e suite.** The first full run on unchanged `main` had one failure,
`persistence.spec.ts:92`, which passed on an isolated re-run; the owner said the same
test had failed the same way on 2026-09-15, and `fieldnote-ccf` records both. The full
run at the end of the session is in the handoff.

**Decisions made in the session rather than read.** The four base fields are listed once
and each table's count includes them, rather than repeating four rows eleven times; the
per-table counts in the handoff and the report are against the schema so a missed field
would show. The request that crosses the egress is a table with four columns — shape and
limit, pseudonymized or not, inside the note delimiter or not — because those are the
three facts session 17 will need per field. The eval-suite path to the provider from CI
is named in §7 as a second path to the same processor, carrying synthetic data only,
because a processor inventory that omits a known path is wrong even when the data is not
real. The hash facts in §6 are written as what can and cannot reproduce or match each
pre-image, and nothing more.

**Spend.** $0. No path under `scripts/evals-watched-paths.mjs` changed.
