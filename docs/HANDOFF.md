# Handoff

Written 2026-09-11, at `6e8ae46` on `feat/session-7-evals`, the session 7 PR, for the
state `main` will be in when it merges.

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
follow-up correspondence for human review. Full detail in `docs/PROJECT-PLAN.md`; this
section is orientation only. `README.md` exists as of this session and is the public
front door.

Two things shape everything else.

**Public build, private fork.** This repository is the de-branded public build:
synthetic data, no manufacturer, no product, no real people anywhere including commit
history. A private fork carries real configuration and is never published. ADR-0001 is
the record.

**Governance is load-bearing, not decorative.** The compliance architecture is
production code held to the same standard as any feature. In practice a control is
expected to be *enforced*, not asserted: the denylist runs in a pre-commit hook and in
CI; the data-access boundary, the single-egress claim, the draft state machine, the
no-draft-without-its-record invariant, and the one-model-call rule are failing tests;
the security headers are asserted against a live response; the adversarial suite runs
against the live model and fails the build if a violation reaches a draft; and where a
control cannot be enforced the documentation says so plainly. `CLAUDE.md` carries the
non-negotiable constraints; they are not preferences.

---

## Where we've been

`main` is at `57b62d3` with 147 commits and 32 merged pull requests; this PR adds ten
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
- **First device run** — **#20**, **#21**, **#22**, **#23**; the certificate authority and
  the hardware walk, **#28**, **#29**, **#30**, **#31**.
- **Session 5, generation** — **#32**; ADR-0007; and the containment of the beads
  database, which had been publishing to the public remote (see *Known gaps*).
- **Between sessions 5 and 6** — **#33** and **#36** (`next` 16.3.4). Dependabot **#26**,
  **#27**, **#35** closed, not merged, each with the reason on it.
- **Session 6, audit log and review gate** — **#37**; ADR-0008. **Between sessions 6
  and 7** — **#38**, the greeting composed from the record, prompt template 1.1.0.
  Dependabot **#34** merged.
- **Session 7, adversarial eval suite** — this PR, ten commits: the model call extracted
  into one shared module; the diff-gated entry; the corpus, runner, and suite; the gating
  tests; two rounds of detector tuning from live runs with the judgement factored out
  and the deterministic gate test; the workflow's full history and measured cost; the
  first `README.md`; the guide amendment and prompt file; this handoff with the
  changelog.

Verified with `git log`, `git rev-list --count main`, and `gh pr list`.

---

## Where we are

`main` is at `57b62d3`, CI green (`gh run list --branch main`). No pull requests are open
besides this one. Zero open Dependabot alerts.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, deliberate for a single-maintainer repository. Verified against the
branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (190), build, and the end-to-end suite (28). `Adversarial guardrail suite` now
means something, with limits:

- **On a PR that changed the prompt, the ruleset, the model settings, the pseudonymizer,
  the corpus, or the runner, it ran twelve cases against the live model, one call each,
  and no violation reached a draft.** On any other PR it skipped the model and said so
  in the log, and green means the gate was not needed, not that it holds. The watched
  list is `scripts/evals-watched-paths.mjs`; a test walks the directories to confirm
  coverage. `workflow_dispatch` always runs live. A run costs about $0.14.
- **One call per case is a sample, not a rate.** The published figures in `README.md` are
  from one run on 2026-09-11. Across five runs and sixty samples this session, by the
  final detectors, the model produced one sender-voice violation and the ruleset caught
  it; every injection payload inside a dictation artifact was ignored.
- **The detectors are narrow by design**, separate from the ruleset, and miss an
  attributed-then-asserted sentence; their limits are in `tests/evals/corpus.ts`. Four
  rounds of tuning on live output were needed before they stopped raising false alarms
  on relayed questions and "rather than"; every one is an oracle in
  `tests/unit/evals-gating.test.ts`.
- **Prompt injection has no rule behind it.** For that class the combined result is the
  prompt-level result, and a payload the model obeyed would fail the build with nothing
  in the ruleset to catch it. That is the design.
- **The ruleset over-blocks relational sentences**, and this is now observable per run:
  it fired on eight of twelve drafts in the published run while the detectors counted
  one. `fieldnote-ay2` has the instances and the single largest cause; no rate is
  claimed.
- **The single-egress check is a grep** and does not see SDK calls at all; the one-model-
  call test (`tests/unit/model-call.test.ts`) is what holds `messages.create` to one
  file. `connect-src 'self'` is the browser-enforced complement.
- **SRI is partial** (`fieldnote-9gp`); **CI enforces structural denylist patterns only**;
  **the end-to-end suite runs on `127.0.0.1` in one browser**; **the service worker's
  update path is untested** (`fieldnote-unp`). All unchanged from session 6.

**The model call is one module.** `src/lib/generation/model-call.ts`, called by the
route and the eval runner, so what the runner measures is what production sends; a test
asserts `messages.create` appears nowhere else in `src/` or `tests/evals/`.

**The greeting is composed from the record**, prompt template 1.1.0, and the corpus's
oracles expect no salutation from the model.

**Everything session 6 established stands**: drafts persist beside their audit records
through one write path, the state table gates export, blocked drafts persist, the audit
record survives event deletion (ADR-0008), the CSV marks orphans, and edit distance is
captured and shown with its caveat.

**Schema is at v2**, unchanged this session.

**Documentation set.** `README.md`, `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`,
`docs/TESTING-ON-DEVICE.md`, eight ADRs with an index, `docs/prompts/` through session 7,
this handoff and its template, `CHANGELOG.md` through session 7, and `SECURITY.md`.
Plan §4.6's `docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`, `docs/THREAT-MODEL.md`,
`docs/DATA-PROTECTION.md`, and `docs/COMPLIANCE-MAP.md` do not exist yet (checked with
`ls`). The README carries eval results by hand from the runner's output and says so;
session 18 fills the rest of it out.

---

## What's next

### Session 8 — Roster import

Read `docs/BUILD-GUIDE.md` session 8 in full before starting; this is a pointer, not a
substitute. Budgeted at ~2 hours. `read-excel-file`, client-side, per ADR-0003; a column
mapping UI, because sign-in sheets never have consistent headers; fuzzy match against
captured names. CSV is a separate entry point in that library. Parsed output is hostile:
validate and normalise every field before it reaches Dexie, and never pass parsed content
into a model call without routing it through the session 4 boundary.

**Done when** a messy real-shaped `.xlsx` imports correctly and the file never touches
the network.

**What earlier sessions hand it.** `fieldnote-g7d`'s note on walk-ins: importing a roster
must not make adding a person mid-event harder or less obvious than it is today, and the
roster's role column is the tokenizer's input (ADR-0007). The greeting composes from
`displayName` as entered; structured fields from an import are where a title could come
from, and `greeting.ts` takes the record so it can use them. Any change under
`src/lib/privacy/` runs the eval suite live. Check the prompt's premises against the
repository before building on them: seven prompts have carried a stale one, and the
eighth held because it was written from a read-only printout the same day.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session: `.beads/config.yaml` has
`git-push: false`, `push-state.json` has not advanced since 2026-09-09, and the remote
carries no `refs/dolt/*`. Nothing about the private material goes into a bead. 48 issues:
26 open, 19 closed, 3 deferred, 15 ready, 11 blocked (`bd stats`). Run `bd ready` and
`bd blocked`.

Named here because they qualify claims made above, per the template; the backlog itself
is not listed. `fieldnote-ay2` — over-blocking has instances and a largest cause, no
rate. `fieldnote-g7d` — the briefing package, which needs an ADR before anything is
built and which session 8 should read for its walk-in note. `fieldnote-5iv` — the
edit-distance dashboard, deferred. `fieldnote-9gp` — SRI does not cover the preloaded
chunks. `fieldnote-quj` — the two rulesets differ. `fieldnote-dx0` — mangled clinical
terms reach the model as fact. `fieldnote-ech` — the denylist matches listed spellings
only. `fieldnote-bdw` — Safari storage durability. `fieldnote-unp` — the service worker
update path. `fieldnote-v2s` — the private fork has no session. `fieldnote-loh` —
session 15's container, deferred, carrying the threat-model entry the containment owes.
Closed this session: `fieldnote-034`, `fieldnote-08m`, `fieldnote-7zo`, `fieldnote-xta`.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.
Close each Dependabot 16.x offer as #27 was, with the reason on it, until #11 lands.

**Session prompts — what was asked.** `docs/prompts/`, one file per session through 7.
Session 7's carries the prompt verbatim and a how-it-went section.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once accepted,
superseded or amended with a dated note. None landed this session. Still owed or worth
considering: ADR-0004 when `fieldnote-bdw` resolves; ADR-0006's five-name evidence
statement; the plan §2 conversation; and the briefing ADR `fieldnote-g7d` requires.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong.** Seven prompts carried a stale premise; the eighth held because it was
  written from a read-only printout of the repository taken the same day. That is the
  shape to keep.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself.
- **Verify by running, not by reasoning.** Every counterfactual named in a test header
  was run. The eval suite's first live run failed, and the cause was the cases: read the
  model's text before deciding which side is wrong.
- **`pnpm evals` costs real spend.** Run it deliberately, count the runs, and report the
  total. `EVALS_ONLY` runs named cases alone; `EVALS_RUN=live` forces a live run.
- **Check what is listening before trusting a red or green e2e run.** `lsof -iTCP:3000`.
- **The denylist can fire on ordinary vocabulary.** Remove the word rather than bypass
  the hook, and do not name it in the commit.
- **Check existence and ignore status separately.** `git check-ignore` is a pattern query.
- **The constraints in `CLAUDE.md` are not optional.**
- **A finding about the private material is not written into any location the
  repository controls.** "Internal" is a claim to verify by looking at where the data
  goes.
- **Never `--no-verify`.** Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks, including every `bd` command.
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** `git rm` stages too. Prettier reformats committed test files
  on commit, so an edit anchored on a fragment you wrote may not match after: anchor on
  what is in the file.
- **One session, one PR.** Findings that are not blocking get beads.
- **Separate commits per logical change.** Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **The eval figures are one sample per case on one day.** Nothing here is a rate. The
  README says so beside the table.
- **The detectors were tuned on the runs they then measured.** Four rounds, each
  recorded as an oracle, and the published run came after the last; but a detector shaped
  by what the model wrote is not independent of it in the way a held-out set would be.
  Session 18's published results should come from runs the detectors were not tuned on.
- **The weakened-ruleset live demonstration failed on an echo**, which the ruleset blocks
  by policy and the final detector does not count. The durable demonstration is the
  deterministic gate test in `Verify`.
- **The route's private-term rule is not in the runner's path.** Absent on every public
  clone, so the public suite cannot measure it. `fieldnote-quj`.
- **The runner has never seen a refusal or a truncation live.** Both paths are handled
  and neither has fired against the real API, in the route or the runner.
- **The containment amendment of 2026-09-09 is not reproduced here.** Its full text is in
  the handoff at commit `2dbdcb1`; its conclusions stand: unreachable objects remain on
  GitHub until GitHub's own garbage collection, no purge was requested, and that was the
  owner's decision on stated reasoning.
- **The hardware run is one phone, one day, iOS 26.6.1.** Nothing built in sessions 5, 6,
  or 7 has been run on hardware.
- **The layout validation is one observed session**; the review surface has not been
  observed in use.
- **Storage durability across Safari's eviction window is untested.** `fieldnote-bdw`.
- **Nothing is deployed.** `fieldnote-6x5`, `fieldnote-ijg`.
- **The private fork has no session and this handoff has no visibility into it.**
- **The dictation evidence is two small samples**, and one observed pair is deliberately
  not in the public documents.
- **Audit records grow without bound** by design (ADR-0008); session 16 owes the
  retention policy.
- **A name with neither a title nor a roster entry is still missed**, and so is a role
  outside the closed head-noun list. ADR-0006 and ADR-0007 state both.
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
