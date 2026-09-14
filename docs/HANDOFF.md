# Handoff

Written 2026-09-14, at `4a74224` on `feat/session-8-roster-import`, the session 8 PR,
for the state `main` will be in when it merges.

Every claim here was checked against the repository, git history, the trackers, or the
GitHub API in the session that wrote it. Where something could not be verified, it says
so rather than smoothing over the gap.

Regenerate this document from `docs/HANDOFF-TEMPLATE.md` at the end of each session, by
re-reading the sources. Do not edit the previous handoff in place — a handoff written
from the last handoff drifts from the repository it describes. This one was written from
the template with the previous handoff closed.

---

## What this is

A local-first PWA for a field representative running demonstration events for regulated
products. It captures attendee interactions in the field and drafts personalised
follow-up correspondence for human review. Full detail in `docs/PROJECT-PLAN.md`;
`README.md` is the public front door; this section is orientation only.

Two things shape everything else.

**Public build, private fork.** This repository is the de-branded public build:
synthetic data, no manufacturer, no product, no real people anywhere including commit
history. A private fork carries real configuration and is never published. ADR-0001 is
the record.

**Governance is load-bearing, not decorative.** The compliance architecture is
production code held to the same standard as any feature. A control is expected to be
*enforced*, not asserted: the denylist runs in a pre-commit hook and in CI; the
data-access boundary, the single-egress claim, the one-model-call rule, the draft state
machine, and the no-draft-without-its-record invariant are failing tests; the security
headers are asserted against a live response; the adversarial suite runs against the
live model and fails the build if a violation reaches a draft; a roster import is shown
to make no network request; and where a control cannot be enforced the documentation
says so plainly. `CLAUDE.md` carries the non-negotiable constraints.

---

## Where we've been

`main` is at `e09a0fa` with 162 commits and 34 merged pull requests; this PR adds nine
commits. `CHANGELOG.md` is the record of what each session shipped, from session 2
onward, and is not repeated here. What follows is the map from session to pull request,
with the closed-not-merged ones named because a closed PR is easy to mistake for one that
never existed.

- **Phase 0, session 1** — two direct commits (`989d459`, `d509dca`), then **#6**, **#7**,
  **#8**. Dependabot **#1**, **#2**, **#4** merged. **#3** and **#5** closed, not merged:
  #3 was the `eslint-config-next` 16 bump that issue #11 tracks as a migration.
- **Documentation** — **#9**, **#10**; **#14** added this document and its template;
  **#16**, **#17**, **#18**; **#24**, **#25**.
- **Session 2, data layer** — **#12**. **Beads** — **#13**.
- **Session 3, capture and offline** — **#15**.
- **Session 4, the privacy boundary** — **#19**; ADR-0006.
- **First device run** — **#20** to **#23**; the certificate authority and the hardware
  walk, **#28** to **#31**.
- **Session 5, generation** — **#32**; ADR-0007; the containment of the beads database
  (see *Known gaps*).
- **Between sessions 5 and 6** — **#33**, **#36**. Dependabot **#26**, **#27**, **#35**
  closed, not merged, each with the reason on it.
- **Session 6, audit log and review gate** — **#37**; ADR-0008. **Between 6 and 7** —
  **#38**, the greeting composed from the record. Dependabot **#34** merged.
- **Session 7, adversarial eval suite** — **#39**. **Between 7 and 8** — **#40**, ruleset
  1.2.0 from the first held-out run.
- **Session 8, roster import** — this PR, nine commits: schema v3 with the atomic import;
  the `canonicalNameOf` export; the messy fixture and its builder; the roster library;
  the matcher fix from the first end-to-end run; the import screen from the switcher;
  the end-to-end spec; the ADR, plan, guide, and prompt documentation; this handoff with
  the changelog.

Verified with `git log`, `git rev-list --count main`, and `gh pr list`.

---

## Where we are

`main` is at `e09a0fa`, CI green. No pull requests are open besides this one. Zero open
Dependabot alerts.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, deliberate for a single-maintainer repository. Verified against the
branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (216), build, and the end-to-end suite (31). `Adversarial guardrail suite`
ran live on this PR because `src/lib/privacy/` changed; on a PR that touches none of the
watched paths it skips the model and says so, and green means the gate was not needed.
The caveats, unchanged from session 7 except where marked:

- **The eval figures are one held-out run at five samples per case.** `README.md` carries
  them, dated: 0 of 60 reached under ruleset 1.2.0, 2 of 60 produced. The detectors have
  been frozen since #39. Prompt injection has no rule behind it, and the ruleset
  over-blocks relational sentences (`fieldnote-ay2`, 29 of 60 samples).
- **The roster import's "never touches the network" is one recorded run.** The spec
  records every request the page makes from the moment the import opens and finds none
  leaving the origin and none to the API route. It runs in Chromium on `127.0.0.1`, with
  the fixture files; it says nothing about a real sheet on a phone.
- **The matcher misses the observed dictation mangling by design**, and its `close` basis
  proposes any one-letter slip on a surname of five or more letters. The representative's
  confirmation is the control; every proposal must be answered before the import button
  enables.
- **The single-egress check is a grep**; the one-model-call test holds `messages.create`
  to one file. **SRI is partial** (`fieldnote-9gp`). **CI enforces structural denylist
  patterns only.** **The end-to-end suite runs in one browser.** **The service worker's
  update path is untested** (`fieldnote-unp`).

**Attendees record where they came from.** Schema v3: `Attendee.source` is `captured`
from the dock or `imported` from a sheet, backfilled `captured` by migration. The roster
is an intention, not a record (`fieldnote-g7d`); session 11's briefing and session 15's
threat model both read this field.

**Import fills, never renames.** `applyRosterImport` takes confirmed decisions in one
transaction: a merge fills an existing attendee's empty role, specialty, and institution
and cannot touch `displayName`; a new row becomes an imported attendee. It has no
matcher. The matcher (`src/lib/roster/match.ts`) proposes on canonical names — exact
across the whole sheet first, then surname, then one edit on a long surname.

**Parsed input is hostile and is treated so.** Format by magic bytes, `.xls` refused
with an instruction, every cell a sanitised string before anything else sees it. CSV is
read by `src/lib/roster/csv.ts`, because `read-excel-file` has no CSV support at 9.3.10 —
ADR-0003's consequence said otherwise and now carries a dated note.

**The dock's add-person flow is untouched**, and the end-to-end spec adds a walk-in after
an import to show it. The import is an option in the event switcher, beside "Start a new
event…", so the header the representative validated is unchanged.

**An imported specialty changes an attendee's token class.** `classify()` calls an
attendee with a non-empty `specialty` a clinician; a "Department" column mapped to
specialty can make a coordinator an HCP token. The heuristic's stated cost, now reachable
(`fieldnote-1o6`).

**Everything sessions 5 to 7 established stands**: the boundary, the greeting composed
from the record, the review gate, the audit record surviving deletion (ADR-0008), the
shared model call, the diff-gated eval suite.

**Documentation set.** `README.md`, `docs/PROJECT-PLAN.md` (now with the data-model
line on `Note.attendeeId` and `Attendee.source`), `docs/BUILD-GUIDE.md`,
`docs/TESTING-ON-DEVICE.md`, eight ADRs with an index, `docs/prompts/` through session 8,
this handoff and its template, `CHANGELOG.md` through session 8, `SECURITY.md`. Plan
§4.6's `docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`, `docs/THREAT-MODEL.md`,
`docs/DATA-PROTECTION.md`, and `docs/COMPLIANCE-MAP.md` do not exist yet (checked with
`ls`).

---

## What's next

### Session 9 — Approved content library

Read `docs/BUILD-GUIDE.md` session 9 in full before starting; this is a pointer, not a
substitute. Budgeted at ~2–3 hours. Storage, upload, and the matcher that validates
claim-bearing output against the library.

**It is blocked**, and the guide says so: plan §7 item 4 — what approved content the
representative actually has — is still open (`Status: open` in the plan), and it decides
whether this is a library-selection feature or a paste field. Nothing in the repository
can settle that. Until it is answered, every draft carries the gap marker and the
claim-bearing rule blocks unconditionally, which is plan §4.2 working and the source of
the over-blocking `fieldnote-ay2` records.

**What earlier sessions hand it.** The eval suite measures both directions once the
library exists: session 7's runner for what the model writes, and `flagsFired` with edit
distance per draft for what the ruleset blanks. The roster now carries `role`,
`specialty`, and `institution` from sheets, which the prompt does not yet use. Any change
under `src/lib/generation/` runs the eval suite live. Check the prompt's premises against
the repository before building on them — and, this time, against the dependency's own
`package.json`: session 8's one stale premise was about a library's API that three
documents had repeated.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session: `.beads/config.yaml` has
`git-push: false` and the remote carries no `refs/dolt/*`. Nothing about the private
material goes into a bead. 51 issues: 27 open, 21 closed, 3 deferred, 16 ready, 11
blocked (`bd stats`). Run `bd ready` and `bd blocked`.

Named here because they qualify claims made above; the backlog itself is not listed.
`fieldnote-1o6` — an imported specialty makes an HCP token. `fieldnote-6qr` — a workbook
with several sheets reads the first only. `fieldnote-ay2` — over-blocking has instances
and a largest cause, no rate. `fieldnote-g7d` — the briefing package, which needs an ADR
before anything is built. `fieldnote-5iv` — the edit-distance dashboard. `fieldnote-9gp`
— SRI. `fieldnote-quj` — the two rulesets differ. `fieldnote-dx0` — mangled clinical
terms. `fieldnote-ech` — the denylist matches listed spellings only. `fieldnote-bdw` —
Safari storage durability. `fieldnote-unp` — the service worker update path.
`fieldnote-v2s` — the private fork has no session. `fieldnote-loh` — session 15's
container, deferred. Closed this session: `fieldnote-g6d`.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.
Close each Dependabot 16.x offer as #27 was, with the reason on it, until #11 lands.

**Session prompts — what was asked.** `docs/prompts/`, one file per session through 8.
Session 8's carries the prompt verbatim and a how-it-went section naming the stale
premise.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once accepted,
superseded or amended with a dated note. ADR-0003 gained a dated note this session. Still
owed or worth considering: ADR-0004 when `fieldnote-bdw` resolves; ADR-0006's five-name
evidence statement; the plan §2 conversation; and the briefing ADR `fieldnote-g7d`
requires.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong.** Nine prompts have run; eight carried a stale premise, and the ninth's
  was a dependency's API that no printout had checked. Print the dependency's exports
  when a prompt leans on them.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself.
- **Verify by running, not by reasoning.** Every counterfactual named in a test header
  was run. The first end-to-end run of the import found the matcher wrong; read what the
  run did before deciding which side is wrong.
- **`pnpm evals` costs real spend.** Run it deliberately, count the runs, and report the
  total. `EVALS_ONLY` runs named cases alone; `EVALS_RUN=live` forces a live run.
- **Check what is listening before trusting a red or green e2e run.** `lsof -iTCP:3000`.
- **The denylist can fire on ordinary vocabulary.** Remove the word rather than bypass
  the hook, and do not name it in the commit.
- **Check existence and ignore status separately.** `git check-ignore` is a pattern query.
- **The constraints in `CLAUDE.md` are not optional.**
- **A finding about the private material is not written into any location the
  repository controls.**
- **Never `--no-verify`.** Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks, including every `bd` command.
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** `git rm` stages too. Prettier reformats committed files on
  commit, so anchor edits on what is in the file. A heredoc or file write that carries a
  literal control character or byte-order mark is refused by the harness; write escapes.
- **One session, one PR.** Findings that are not blocking get beads.
- **Separate commits per logical change.** Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **The import has been run on the fixtures only.** No real sign-in sheet has been
  through it, and ADR-0003 warns that `read-excel-file` has not absorbed a decade of
  pathological spreadsheets. The header detector handles the shapes the fixture names;
  a sheet with a shape it does not name may find nothing, and then says so.
- **The "never touches the network" demonstration is one browser, one origin, the
  fixtures.** It records the page's own requests; a dependency phoning home from inside a
  worker the page did not open would not be in that list. Nothing here suggests one.
- **The matcher's bases were chosen, not measured.** Exact, surname, one edit on five or
  more letters; no data on how often each proposes wrongly. The review step is the
  control and every proposal must be answered.
- **Session 9 is blocked on plan §7 item 4** and nothing in the repository can unblock it.
- **The eval figures are one held-out run, one day.**
- **The containment amendment of 2026-09-09 is not reproduced here.** Its full text is in
  the handoff at commit `2dbdcb1`; its conclusions stand.
- **The hardware run is one phone, one day, iOS 26.6.1.** Nothing built in sessions 5 to
  8 has been run on hardware. The file picker on iOS is the thing most likely to behave
  differently.
- **The layout validation is one observed session**; the review surface and the import
  screen have not been observed in use.
- **Storage durability across Safari's eviction window is untested.** `fieldnote-bdw`.
- **Nothing is deployed.** `fieldnote-6x5`, `fieldnote-ijg`.
- **The private fork has no session and this handoff has no visibility into it.**
- **Audit records grow without bound** by design (ADR-0008); session 16 owes retention.
- **A name with neither a title nor a roster entry is still missed**, and import makes
  that case more likely, not less (`fieldnote-g7d`); `Attendee.source` records which
  entries were seen, it does not find the ones that were not.
- **Session-to-PR attribution before session 2 is partly inferred.**
- **Hours in the build guide are estimates, not measurements.**

---

## How to use this

**Regenerate, do not edit.** Write each handoff by re-reading the sources — `git log`,
the build guide, `CLAUDE.md`, `docs/adr/README.md`, `bd ready`, `bd blocked`, and the
open GitHub issues.

**Point, do not copy.** Anything with a canonical home gets a pointer.

**Every claim traceable.** To a file, a commit, or a command run while writing. If it is
not, say so in *Known gaps* rather than dropping it silently or asserting it anyway.
