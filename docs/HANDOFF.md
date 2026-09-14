# Handoff

Written 2026-09-14, at the head of `feat/session-9-approved-content`, the session 9 PR,
for the state `main` will be in when it merges. `main` is at `edb292a`; the branch adds
thirteen commits including this one.

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
history. A private fork carries real configuration — and, as of this session, the real
approved content, loaded one passage at a time into a library the public build ships
empty. ADR-0001 is the record.

**Governance is load-bearing, not decorative.** The compliance architecture is
production code held to the same standard as any feature. A control is expected to be
*enforced*, not asserted: the denylist runs in a pre-commit hook and in CI; the
data-access boundary, the single-egress claim, the one-model-call rule, the draft state
machine, and the no-draft-without-its-record invariant are failing tests; the security
headers are asserted against a live response; the adversarial suite runs against the
live model and fails the build if a violation reaches a draft; a roster import is shown
to make no network request; claim-bearing text is selected from the library or blocked,
never authored; and where a control cannot be enforced the documentation says so
plainly. `CLAUDE.md` carries the non-negotiable constraints.

---

## Where we've been

`main` is at `edb292a` with 181 commits and 37 merged pull requests; this PR adds
thirteen commits. `CHANGELOG.md` is the record of what each session shipped, from
session 2 onward, and is not repeated here. What follows is the map from session to pull
request, with the closed-not-merged ones named because a closed PR is easy to mistake
for one that never existed.

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
- **Session 10, ADR-0009, the attendee view, and the clinician field** — **#42**, merged
  after **#43**, which recorded plan §7 item 4 as received and unblocked session 9.
- **Session 9, the approved content library** — this PR, thirteen commits in the order
  the prompt set with one move: schema v5 and the library's storage; ruleset 1.3.0
  (moved forward, because the exemption for approved spans lives there); the dock's
  clinician rule (`fieldnote-frx`); the matcher and the refusing library; prompt
  template 1.2.0; passages in the request, route, and pipeline; the fixtures and the two
  eval classes; the library screen and the detail view's line; two fixes to the eval
  measurement found by the held-out run; the documentation; this handoff with the
  changelog.

Verified with `git log`, `git rev-list --count main`, and `gh pr list`.

---

## Where we are

`main` is at `edb292a`, CI green. No pull requests are open besides this one. Zero open
Dependabot alerts.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, deliberate for a single-maintainer repository. Verified against the
branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (250), build, and the end-to-end suite (34). `Adversarial guardrail suite`
runs live on this PR because the prompt, the ruleset, and the corpus all changed, and on
a PR that touches none of the watched paths it skips the model and says so. The caveats,
unchanged from session 10 except where marked:

- **The eval figures are one held-out run at five samples per case**, in `README.md`,
  dated — and, new this session, **the two passage-class rows are not held out**: their
  detector was fixed twice in the session that measured them, on the crash and the
  false alarms the README describes. The next run is the held-out one for those rows.
  The twelve original detectors are frozen. Prompt injection has no rule behind it; the
  ruleset over-blocks relational sentences (`fieldnote-ay2`), one cause fewer since
  1.3.0.
- **The matcher is exact and the exemption is only as safe as loading is strict.** An
  approved span passes every rule, the indication rule included, so the library refuses
  a passage at load on the pricing, hospitality, patient, and invented-name rules and
  the structural guard. A passage that passes those and is nonetheless wrong for a
  follow-up is the private fork's review problem, not something the code can see.
- **The library has been run with synthetic passages only.** The real material exists
  and has been read; none of it is in the repository, and no draft has been generated
  against it. Whether real approved copy — with its third-party marks and its regulatory
  footer — matches, loads, and reads well in a follow-up is unverified.
- **The token class is a field a human sets or corrects.** The dock now writes `hcp` for
  a typed Dr or Prof and `staff` otherwise; the view corrects either.
- **The attendee view's history is joined by canonical name**, exactly the join the
  pseudonymizer uses: a rename at one event detaches that record from the person's
  history at others (`fieldnote-m28`). The view says so. Nothing is fetched.
- **The roster import's "never touches the network" is one recorded run** on the
  fixtures. **The matcher's bases were chosen, not measured.**
- **The single-egress check is a grep**; **SRI is partial** (`fieldnote-9gp`); **CI
  enforces structural denylist patterns only**; **the end-to-end suite runs in one
  browser**; **the service worker's update path is untested** (`fieldnote-unp`).

**Plan §4.2 is now implemented as written.** Claim-bearing text is selected from the
library and copied exactly, or blocked with the gap marker; nothing in between. The
matcher (`src/lib/generation/approved.ts`) holds approved spans out of every rule with a
U+0001 placeholder — distinct from the pseudonymizer's U+0000 ones, which never leave
`pseudonymize()` — and restores the library's own body after. Normalisation is
whitespace, curly quotes, and the dash family; case and everything else are preserved on
purpose, and the module header says why.

**Schema is at v5.** The audit record carries `passagesUsed` and `libraryVersion`,
backfilled by migration v5 with a test; ADR-0008 carries the dated note. The library's
`ApprovedContentRecord` existed since session 2 and gains storage functions now; its
encryption classification is `clear` and `fieldnote-ao9` revisits that at session 19.

**Versions.** Prompt template 1.2.0; guardrail ruleset 1.3.0; both recorded on every
audit record.

**Documentation set.** `README.md` (eval section rewritten for this run),
`docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md` (session 9 amended on completion),
`docs/TESTING-ON-DEVICE.md`, nine ADRs with an index, `docs/prompts/` through session
10 with session 9 added, this handoff and its template, `CHANGELOG.md` through session
9, `SECURITY.md`. Plan §4.6's `docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`,
`docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, and `docs/COMPLIANCE-MAP.md` do not
exist yet (checked with `ls docs`).

---

## What's next

### Session 11 — Briefing PDF

Specified by ADR-0009 and the guide's dated note under session 10: the form the
representative fills — event details, logistics, contacts, per-attendee text she types
or dictates — photo upload and its storage as a binary entity with the cipher extended
for it, the document laid out and offered as a download, no model. Read the guide's
session 11 entry with its amendment and ADR-0009 in full, then `fieldnote-g7d`'s
remaining gaps: event metadata the record does not hold, the representative's own team
as a second class of person, and the document stating expected attendance as of the
generation date. Budgeted at ~4 hours and expected to run long. It needs no dependency
decision the repository has not made, except how a PDF is produced on the device, which
the guide does not say and which the scope guard in `CLAUDE.md` — no new dependency
without saying so — makes a decision to state up front. `fieldnote-m28` is a limit the
briefing inherits: history is joined by name.

Before it, or beside it: a run of the library against the real material in the private
fork is the one thing this session could not do, and it is the check that decides
whether the matcher's normalisation is right for copy that was typeset rather than
typed.

Either way: check the prompt's premises against the repository, and against any
dependency's own `package.json`, before building on them.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session: `.beads/config.yaml` has
`git-push: false` and the remote carries no `refs/dolt/*`. 53 issues: 27 open, 23
closed, 3 deferred, 16 ready, 11 blocked (`bd stats`). Run `bd ready` and `bd blocked`.

Named here because they qualify claims made above; the backlog itself is not listed.
`fieldnote-g7d` — the briefing package, session 11's source. `fieldnote-ay2` —
over-blocking has instances and one cause fewer, no rate; its note carries this session's
run. `fieldnote-ao9` — the library body's encryption class, at session 19.
`fieldnote-quj` — the two rulesets differ, and the route now protects approved spans
before the private-term rule for that reason. `fieldnote-m28` — history joined by name.
`fieldnote-6qr` — a workbook with several sheets reads the first only. `fieldnote-5iv` —
the edit-distance dashboard. `fieldnote-9gp` — SRI. `fieldnote-dx0` — mangled clinical
terms. `fieldnote-ech` — the denylist matches listed spellings only. `fieldnote-bdw` —
Safari storage durability. `fieldnote-unp` — the service worker update path.
`fieldnote-v2s` — the private fork has no session. Closed this session: `fieldnote-frx`.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.

**Session prompts — what was asked.** `docs/prompts/`, one file per session through 10.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once accepted,
superseded or amended with a dated note. ADR-0008 amended this session. Still owed or
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
  them.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself.
- **Verify by running, not by reasoning.** Every counterfactual named in a test header
  was run.
- **`pnpm evals` costs real spend.** Run it deliberately, count the runs, and report the
  total. When the gate fails, read the samples before deciding whether the measurement
  or the guardrail is wrong; this session's two reruns were both the measurement.
- **Check what is listening before trusting a red or green e2e run.** `lsof -iTCP:3000`.
- **The denylist can fire on ordinary vocabulary.** Remove the word rather than bypass
  the hook, and do not name it in the commit.
- **Check existence and ignore status separately.** `git check-ignore` is a pattern query.
- **The constraints in `CLAUDE.md` are not optional.**
- **A finding about the private material is not written into any location the
  repository controls.** The material's shape may decide a session; the material itself
  reaches no fixture, test string, bead, or commit message.
- **Never `--no-verify`.** Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks, including every `bd` command.
- **`bd update --notes` replaces the field.** Read the existing notes first and write
  them back with the addition; this session wiped one and restored it from a printout.
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** `git rm` stages too. Prettier reformats committed files, so
  anchor an edit on what is in the file. A file write carrying a literal control
  character or byte-order mark is refused by the harness; write escapes.
- **One session, one PR.** Findings that are not blocking get beads.
- **Separate commits per logical change.** An ADR and its consequences come before any
  code that depends on them. Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **The library has never held real approved copy.** Every passage that has been loaded,
  matched, or refused is invented. The matcher's normalisation was chosen against typed
  text; typeset copy may carry characters it does not fold.
- **The two passage-class eval rows were measured with a detector fixed in the same
  session**, twice. They are the calibration figures for those classes; the next run is
  the held-out one.
- **The library screen has been run in one browser on the fixtures** and never on
  hardware or in use.
- **A passage that passes the load rules can still be wrong for a follow-up.** The load
  rules are the four named plus the structural guard; the regulatory footer of a real
  brochure passes them by design and whether it belongs in an email is a compliance
  question the code does not answer.
- **The migration test runs the upgrade function over fake rows**, not Dexie's own
  upgrade transaction against IndexedDB.
- **The eval figures are one held-out run, one day**, and the hospitality class produced
  on 3 of 5 samples where the earlier run had none; five samples of a nondeterministic
  model is what that variance looks like, and nothing here measures it.
- **The containment amendment of 2026-09-09 is not reproduced here.** Its full text is in
  the handoff at commit `2dbdcb1`; its conclusions stand.
- **The hardware run is one phone, one day, iOS 26.6.1.** Nothing built in sessions 5 to
  10 has been run on hardware.
- **The layout validation is one observed session**; the review surface, the import
  screen, the attendee view, and the library have not been observed in use.
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
