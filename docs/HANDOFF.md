# Handoff

Written 2026-09-14, at `a5d94f7` on `feat/session-10-attendee-view`, the session 10 PR,
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

`main` is at `294d6c6` with 172 commits and 35 merged pull requests; this PR adds five
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
  **#38**. Dependabot **#34** merged.
- **Session 7, adversarial eval suite** — **#39**. **Between 7 and 8** — **#40**, ruleset
  1.2.0 from the first held-out run.
- **Session 8, roster import** — **#41**; ADR-0003 amended.
- **Session 10, ADR-0009, the attendee view, and the clinician field** — this PR, five
  commits: the ADR with its consequences applied to the plan and the guide; schema v4
  with `Attendee.kind`, its migration and test, and the pseudonymizer reading the field;
  the attendee view and the people list; the prompt file; this handoff with the
  changelog. Session 9 was skipped over: it is blocked on plan §7 item 4, and session 10
  did not depend on it.

Verified with `git log`, `git rev-list --count main`, and `gh pr list`.

---

## Where we are

`main` is at `294d6c6`, CI green. No pull requests are open besides this one. Zero open
Dependabot alerts.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, deliberate for a single-maintainer repository. Verified against the
branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (222), build, and the end-to-end suite (32). `Adversarial guardrail suite`
ran live on this PR because `src/lib/privacy/` changed — `classify()` reads a field now —
and on a PR that touches none of the watched paths it skips the model and says so. The
caveats, unchanged from session 8 except where marked:

- **The eval figures are one held-out run at five samples per case**, in `README.md`,
  dated. The detectors are frozen. Prompt injection has no rule behind it; the ruleset
  over-blocks relational sentences (`fieldnote-ay2`).
- **The token class is now a field a human sets or corrects**, not a heuristic. The
  dock writes `staff` for everyone; import reads a title of Dr or Prof; the view corrects
  either. A clinician added from the dock is `staff` until someone opens the view, and
  the model is then told "a colleague". The heuristic's stated cost, now in a place a
  person can see and fix.
- **The attendee view's history is joined by canonical name**, exactly the join the
  pseudonymizer uses and no looser: "Dr Vance" and "Dr. Peter Vance" are two people to
  it. The view says so. Nothing is fetched.
- **The roster import's "never touches the network" is one recorded run** on the
  fixtures. **The matcher's bases were chosen, not measured.**
- **The single-egress check is a grep**; **SRI is partial** (`fieldnote-9gp`); **CI
  enforces structural denylist patterns only**; **the end-to-end suite runs in one
  browser**; **the service worker's update path is untested** (`fieldnote-unp`).

**ADR-0009 decides the briefing's shape.** The application lays it out from what the
representative enters and offers it as a download; it never sends it; the model writes
none of it; deal positioning has no home in the public build. The single-egress claim
survives as written and the review gate does not apply, because nothing is generated.
Plan §3.2's suggested openers and selected talking points are withdrawn. Photo upload
and its storage — a binary entity the cipher does not yet serialise — go to session 11
with the form the representative fills.

**Schema is at v4.** `Attendee.kind` (`hcp` | `staff`, plan §4.1's words) joins `source`
(v3). Migration v4 backfills `kind` from the old `specialty` heuristic, and
`tests/unit/migration-v4.test.ts` runs that migration over v3 rows through a seam added
to the fake database — the first migration test in the repository.

**The attendee view exists.** `src/components/attendees/`: a people list reached from the
event switcher's third option, and one person's record — five fields editable, `source`
read-only — with their notes and drafts across every event on the device, joined by
name, oldest event first, and a draft opening in the existing detail view. Its first
line says it shows what the phone holds and fetches nothing. No photo, no opener.

**Everything sessions 5 to 8 established stands**: the boundary, the greeting composed
from the record, the review gate, the audit record surviving deletion, the shared model
call, the diff-gated eval suite, the roster import that fills and never renames.

**Documentation set.** `README.md`, `docs/PROJECT-PLAN.md` (§3.2 now carries the
ADR-0009 note), `docs/BUILD-GUIDE.md` (sessions 10 and 11 amended), `docs/TESTING-ON-DEVICE.md`,
nine ADRs with an index, `docs/prompts/` through session 10, this handoff and its
template, `CHANGELOG.md` through session 10, `SECURITY.md`. Plan §4.6's
`docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`, `docs/THREAT-MODEL.md`,
`docs/DATA-PROTECTION.md`, and `docs/COMPLIANCE-MAP.md` do not exist yet (checked with
`ls`).

---

## What's next

### Session 11 — Briefing PDF, or session 9 — Approved content library

Two candidates, and the order is the owner's.

**Session 11** is now specified by ADR-0009 and the guide's dated note: the form the
representative fills — event details, logistics, contacts, per-attendee text she types
or dictates — photo upload and its storage as a binary entity with the cipher extended
for it, the document laid out and offered as a download, no model. Read the guide's
session 11 entry with its amendment and ADR-0009 in full, then `fieldnote-g7d`'s
remaining gaps: event metadata the record does not hold, the representative's own team as
a second class of person, and the document stating expected attendance as of the
generation date. Budgeted at ~4 hours and expected to run long. It needs no dependency
decision the repository has not made, except how a PDF is produced on the device, which
the guide does not say.

**Session 9** is still blocked on plan §7 item 4 (`Status: open` in the plan): what
approved content the representative actually has, which decides whether it is a
library-selection feature or a paste field. Nothing in the repository can settle that.

Either way: check the prompt's premises against the repository, and against any
dependency's own `package.json`, before building on them.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session: `.beads/config.yaml` has
`git-push: false` and the remote carries no `refs/dolt/*`. 51 issues: 26 open, 22 closed,
3 deferred, 15 ready, 11 blocked (`bd stats`). Run `bd ready` and `bd blocked`.

Named here because they qualify claims made above; the backlog itself is not listed.
`fieldnote-g7d` — the briefing package: its ADR is written; its schema and entity gaps go
to session 11, and its post-event readout is not decided by ADR-0009. `fieldnote-6qr` —
a workbook with several sheets reads the first only. `fieldnote-ay2` — over-blocking has
instances and a largest cause, no rate. `fieldnote-5iv` — the edit-distance dashboard.
`fieldnote-9gp` — SRI. `fieldnote-quj` — the two rulesets differ. `fieldnote-dx0` —
mangled clinical terms. `fieldnote-ech` — the denylist matches listed spellings only.
`fieldnote-bdw` — Safari storage durability. `fieldnote-unp` — the service worker update
path. `fieldnote-v2s` — the private fork has no session. `fieldnote-loh` — session 15's
container, deferred. Closed this session: `fieldnote-1o6`.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.

**Session prompts — what was asked.** `docs/prompts/`, one file per session through 10.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once accepted,
superseded or amended with a dated note. ADR-0009 landed this session. Still owed or
worth considering: ADR-0004 when `fieldnote-bdw` resolves; ADR-0006's five-name evidence
statement; the plan §2 conversation; and a decision on the post-event readout and staff
thank-yous, a second generation path with an internal audience that ADR-0009 does not
cover.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong.** Print a dependency's `package.json` exports when a prompt leans on
  them; session 8's one stale premise was a library's API that three documents had
  repeated.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself.
- **Verify by running, not by reasoning.** Every counterfactual named in a test header
  was run.
- **`pnpm evals` costs real spend.** Run it deliberately, count the runs, and report the
  total.
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
- **Stage explicit paths.** `git rm` stages too. Prettier reformats committed files, so
  anchor an edit on what is in the file, with whitespace-tolerant matching for a line it
  may have wrapped. A file write carrying a literal control character or byte-order mark
  is refused by the harness; write escapes.
- **One session, one PR.** Findings that are not blocking get beads.
- **Separate commits per logical change.** An ADR and its consequences come before any
  code that depends on them. Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **The attendee view has been run on the fixtures and one browser only**, like the
  import. The name-join across events has a unit oracle and no real data behind it.
- **A clinician added from the dock is `staff` until corrected.** The dock grows no
  toggle by decision; the view is the correction. Nothing reminds the representative to
  open it.
- **The migration test runs the upgrade function over fake rows**, not Dexie's own
  upgrade transaction against IndexedDB. A populated v3 store from a real device has not
  been upgraded, because none exists outside the developer's own.
- **Session 9 is blocked on plan §7 item 4** and nothing in the repository can unblock it.
- **The eval figures are one held-out run, one day.**
- **The containment amendment of 2026-09-09 is not reproduced here.** Its full text is in
  the handoff at commit `2dbdcb1`; its conclusions stand.
- **The hardware run is one phone, one day, iOS 26.6.1.** Nothing built in sessions 5 to
  10 has been run on hardware.
- **The layout validation is one observed session**; the review surface, the import
  screen, and the attendee view have not been observed in use.
- **Storage durability across Safari's eviction window is untested.** `fieldnote-bdw`.
- **Nothing is deployed.** `fieldnote-6x5`, `fieldnote-ijg`.
- **The private fork has no session and this handoff has no visibility into it.**
- **Audit records grow without bound** by design (ADR-0008); session 16 owes retention.
- **A name with neither a title nor a roster entry is still missed.** ADR-0006, ADR-0007.
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
