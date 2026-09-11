# Handoff

Written 2026-09-11, at `4840558` on `feat/session-6-audit-review`, the session 6 PR,
for the state `main` will be in when it merges.

Every claim here was checked against the repository, git history, the trackers, or the
GitHub API in the session that wrote it. Where something could not be verified, it says
so rather than smoothing over the gap.

Regenerate this document from `docs/HANDOFF-TEMPLATE.md` at the end of each session, by
re-reading the sources. Do not edit the previous handoff in place — a handoff written
from the last handoff drifts from the repository it describes. This one was written from
the template with the previous handoff closed; what that changed is under *Known gaps*.

---

## What this is

A local-first PWA for a field representative running demonstration events for regulated
products. It captures attendee interactions in the field and drafts personalised
follow-up correspondence for human review. Full detail in `docs/PROJECT-PLAN.md`; this
section is orientation only.

Two things shape everything else.

**Public build, private fork.** This repository is the de-branded public build:
synthetic data, no manufacturer, no product, no real people anywhere including commit
history. A private fork carries real configuration and is never published. ADR-0001 is
the record.

**Governance is load-bearing, not decorative.** The compliance architecture is
production code held to the same standard as any feature. In practice that means a
control is expected to be *enforced*, not asserted: the denylist runs in a pre-commit
hook and in CI; the data-access boundary, the single-egress claim, the draft state
machine, and the no-draft-without-its-record invariant are failing tests rather than
conventions; the security headers are asserted against a live response; and where a
control cannot be enforced the documentation says so plainly. `CLAUDE.md` carries the
non-negotiable constraints; they are not preferences, and a change that violates one is
wrong regardless of how well it is implemented.

---

## Where we've been

`main` is at `9dc1546` with 127 commits and 29 merged pull requests; this PR adds ten
commits. `CHANGELOG.md` is the record of what each session shipped, from session 2
onward, and is not repeated here. What follows is the map from session to pull request,
with the closed-not-merged ones named because a closed PR is easy to mistake for one that
never existed.

- **Phase 0, session 1** — two direct commits (`989d459`, `d509dca`), then **#6**, **#7**,
  **#8**. Dependabot **#1**, **#2**, **#4** merged. **#3** and **#5** closed, not merged:
  #3 was the `eslint-config-next` 16 bump that issue #11 tracks as a migration.
- **Documentation** — **#9**, **#10**; **#14** added this document and its template;
  **#16**, **#17**, **#18** between sessions 3 and 4; **#24**, **#25** before session 5.
- **Session 2, data layer** — **#12**. **Beads** — **#13**, which also restored the
  pre-commit hook path `bd init` had repointed.
- **Session 3, capture and offline** — **#15**. Built from plan §3.1, not ported from a
  prototype that no longer existed.
- **Session 4, the privacy boundary** — **#19**; ADR-0006.
- **First device run** — **#20**, **#21**, **#22**, **#23**; the certificate authority and
  the hardware walk, **#28**, **#29**, **#30**, **#31**.
- **Session 5, generation** — **#32**, twenty-four commits, merged 2026-09-09; ADR-0007.
  It also contained the containment of the beads database, which had been publishing to
  the public remote on every write (see *Known gaps*).
- **Between sessions 5 and 6** — **#33** (changelog backfill, handoff, gate 1b closed,
  two stale documents corrected, the session 6 prompt verified) and **#36** (`next`
  16.3.4 clearing five Dependabot alerts, with the headers spec it needed). Dependabot
  **#26**, **#27**, and **#35** closed, not merged, each with the reason on it: #27 was
  the #11 migration again; #26 and #35 were superseded by #36.
- **Session 6, audit log and review gate** — this PR, ten commits: schema v2 and the
  state machine; the pipeline's hashes; edit distance; drafts persisted beside their
  audit records with the two transitions; the CSV; the private-term id moved to the
  shared contract; the review surface replacing the throwaway; ADR-0008; the guide and
  prompt notes; and this handoff with the changelog.

Verified with `git log`, `git rev-list --count main`, `gh pr list --state merged`, and
`gh pr list --state closed`.

---

## Where we are

`main` is at `9dc1546`, CI green (`gh run list --branch main`). One pull request is open
besides this one: Dependabot's **#34**, a GitHub Actions bump, which can merge on its own
green run. Zero open Dependabot alerts (`gh api .../dependabot/alerts?state=open`); there
were five on 2026-09-09, cleared by #36.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, deliberate for a single-maintainer repository: the gate is CI, not review.
Verified against the branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (160), build, and the end-to-end suite (28): the security headers on a live
response, the offline shell after a hard reload with the network gone, capture,
persistence, crash recovery, the environment gates, and now the review gate end to end
with the one network call intercepted. Those are real. The caveats matter more than the
badge:

- **The eval suite passes against zero cases.** `scripts/evals.mjs` prints
  `evals: no cases defined yet (scaffold placeholder)` and exits 0, and it is a
  *required* check. The adversarial cases that exist are Vitest tests under `pnpm test`,
  each with a counterfactual. They verify the ruleset and, since this session, the data
  layer's invariants. They do not verify the model's behaviour under the prompt.
  `fieldnote-08m`, `fieldnote-034`.
- **The review gate's end-to-end coverage uses a canned model.** `tests/e2e/review.spec.ts`
  intercepts `/api/generate` and answers with a fixed draft. Everything after the model —
  persistence, the state machine, the clipboard, the distance, the CSV — runs for real in
  a real browser; the model does not. That is the design, so the suite runs without a
  key, and it means the suite says nothing about what the model writes.
- **The single-egress check is a grep.** It catches the careless case and not the
  determined one. `connect-src 'self'` in the CSP is the browser-enforced complement.
- **SRI is partial**, and unchanged by `next` 16.3.4: the entry scripts and the polyfill
  carry `integrity`, the two preloaded client chunks do not. 16.3.4 puts the nonce on
  every script and dropped `crossorigin` from the chunks; the spec now matches an
  uncovered script by its `src` alone. `fieldnote-9gp` has the dated note.
- **The claim-bearing classifier is a heuristic** with an unmeasured false-negative rate
  (`fieldnote-08m`) and, as of this session, an instrument but no measurement for its
  false-positive rate (`fieldnote-ay2`). Every draft today carries the gap marker,
  because claim-bearing text is blocked unconditionally until session 9's library exists.
- **The public ruleset is generic; the private fork's is not, and the difference is not
  reviewable here.** `fieldnote-quj` says one exists and nothing more.
- **CI enforces structural denylist patterns only.** The term list is local and
  gitignored. Only the pre-commit hook can catch a listed term, and it matches listed
  spellings, not names (`fieldnote-ech`).
- **The end-to-end suite runs on `127.0.0.1`, in one browser.** No trusted certificate
  authority, no home-screen install, no Safari eviction window. Nothing built in session
  5 or 6 has been run on hardware.
- **The service worker's update path is not covered by any test.** `fieldnote-unp`.

**Every generation writes a record, and no draft exists without one.** The suspension
session 5 recorded is over. `createDraftWithAudit` is the only write path for a draft and
writes both rows in one transaction; there is no `createDraft`. Demonstrated: the audit
write made to fail leaves no draft; the draft write made to fail leaves no record.

**The review gate is a transition table.** `src/lib/db/draft-state.ts`: `generated` →
`reviewed` → `exported`, and `blocked` with no outgoing edge. Export is refused from
`generated`; nothing leaves `blocked`; the test walks the graph, so an edge added
carelessly later fails it. Opening a draft in the detail view is the act that marks it
reviewed. The list cannot export.

**Blocked drafts persist.** A refusal, a truncation, a failed request, a withheld
hallucination — each is a draft with a reason and no body, and an audit record with the
reason, the input hash, and, where the model produced text that was withheld, the output
hash.

**The audit record is self-contained and survives event deletion.** ADR-0008. Ids,
hashes, versions, flags, the blocked reason, the two timestamps, and the edit facts, null
until export. Nothing on it is content. The CSV lists every record with an `eventStatus`
column, `present` or `deleted`.

**Edit distance is captured and shown plainly; the dashboard is deferred.** Character
Levenshtein from `generatedBody` to what was copied, on the audit record, on the draft
after export, and on the list beside the flags. Every surface says what it does not mean.
`fieldnote-5iv` records what a dashboard would need.

**The privacy boundary is unchanged** from session 5: roster names, a token after a title,
and role references (ADR-0006, ADR-0007), with the guard on both sides of the model. The
review spec asserts that the intercepted request carries tokens and no name. Since the
greeting fix the model is told not to write a salutation and the pipeline composes one
from the record after rehydration, outside the output hash; the prompt template is at
1.1.0 and the audit record carries it.

**Schema is at v2** with a migration that, in practice, rewrites nothing: no v1 build ever
persisted a draft. The upgrade is there because `CLAUDE.md` requires one.

**Documentation set.** `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`,
`docs/TESTING-ON-DEVICE.md`, eight ADRs with an index at `docs/adr/README.md`,
`docs/prompts/` through session 6, this handoff and its template, `CHANGELOG.md` through
session 6, and `SECURITY.md`. Plan §4.6's `README.md`, `docs/ARCHITECTURE.md`,
`docs/AI-SYSTEM-CARD.md`, `docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, and
`docs/COMPLIANCE-MAP.md` do not exist yet (checked with `ls`).

---

## What's next

### Session 7 — Eval suite

Read `docs/BUILD-GUIDE.md` session 7 in full before starting; this is a pointer, not a
substitute, and the entry carries three dated amendments. Budgeted at ~4 hours, "and this
one runs long". The adversarial corpus from plan §4.5, the runner, and CI integration with
a pass threshold.

**Done when** a case exists for every class in plan §4.5, the runner executes them
against the live prompt, CI fails on a guardrail regression, and the pass rate is
published.

**What the last two sessions hand it.** The ruleset's cases are Vitest tests in
`tests/unit/guardrails.test.ts`; the runner's job is to find out whether the model
produces what those inputs imitate. Session 6's cases are *not* corpus cases — they are
data-layer invariants and stay where they are; the guide's session 7 entry says so.
Blocked on nothing; before starting, merge #34. And check the prompt's premises against
the repository before building on them: six prompts have now carried a stale one.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session by doing: `.beads/config.yaml` has
`git-push: false` with the containment note, `push-state.json` has not advanced since
2026-09-09, and `git ls-remote origin 'refs/dolt/*'` returns nothing. Nothing about the
private material goes into a bead regardless. 47 issues: 29 open, 14 closed, 4 deferred,
17 ready, 12 blocked (`bd stats`). Run `bd ready` for what is actionable and `bd blocked`
for what is waiting and on what. Session-container beads are deferred so they do not
compete with real work.

Named here because they qualify claims made above, per the template's rule; the backlog
itself is not listed. `fieldnote-g7d` — the pre-meeting briefing package, the
representative's own request, needs an ADR before anything is built because the document
leaves the device; it should be read before session 10 or 11 designs anything.
`fieldnote-ay2` — the false-positive rate is unmeasured; session 6 built the instrument.
`fieldnote-5iv` — the edit-distance dashboard, deferred. `fieldnote-08m` — model-level
behaviour is unverified until session 7's runner exists. `fieldnote-034` — the eval suite
passes against zero cases. `fieldnote-9gp` — SRI does not cover the preloaded chunks.
`fieldnote-quj` — the two rulesets differ. `fieldnote-dx0` — mangled clinical terms
reach the model as fact. `fieldnote-ech` — the denylist matches listed spellings only.
`fieldnote-bdw` — Safari storage durability. `fieldnote-unp` — the service worker update
path. `fieldnote-v2s` — the private fork has no session. `fieldnote-loh` — session 15's
container, deferred, which carries the threat-model entry the containment owes. Closed
this session: `fieldnote-aev`, `fieldnote-x9p`. The previous handoff named
`fieldnote-n8z` as open; it is closed, by #22.

**GitHub issues — public record.** One open: **#11**, migrating ESLint to flat config and
upgrading `eslint-config-next` to 16.x. Dependabot offers the 16.x bump at each patch;
close each as #27 was, with the reason on it, until #11 lands.

**Session prompts — what was asked.** `docs/prompts/`, one file per session. Session 6's
was verified against the repository before it was sent and carries its corrections marked
in place, plus a how-it-went section. Between-session PRs have no prompt file.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`. Records are immutable
once accepted: superseded by a new record when a decision changes, amended in place with
a dated note when a consequence is added. ADR-0008 landed this session; ADR-0004 gained a
dated note on retention. Still owed or worth considering: ADR-0004 when `fieldnote-bdw`
resolves; ADR-0006's five-name evidence statement, which does not know about the
vocabulary failure class; the plan §2 conversation; and the briefing ADR `fieldnote-g7d`
requires.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means. A session brief is a summary
  of it, and summaries drop the constraint that mattered.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong.** Six prompts have now carried something the repository could not
  support. Session 6's was checked before it was sent, which is the better shape: the
  record then matches what was asked, and the session still found things.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself rather
  than letting a green suite imply otherwise.
- **Verify by running, not by reasoning.** The standard is to demonstrate a control by
  removing it and watching something fail. Every counterfactual named in a test header
  was run.
- **Check what is listening before trusting a red or green e2e run.** Playwright reuses an
  existing server on port 3000 outside CI. `lsof -iTCP:3000` first.
- **The denylist can fire on ordinary vocabulary.** Remove the word rather than bypass
  the hook, and do not name it in the commit.
- **Check existence and ignore status separately.** `git check-ignore` is a pattern
  query: it reports a match whether or not the file exists.
- **The constraints in `CLAUDE.md` are not optional.** If a task requires violating one,
  stop and say so rather than finding a way around it. The constraint is the point.
- **A finding about the private material is not written into any location the
  repository controls.** The public record says one exists; the substance goes to the
  owner. "Internal" is a claim to verify by looking at where the data goes, never a
  tool's description of itself.
- **Never `--no-verify`.** If the pre-commit hook fires, stop and show the output. Check
  `git config core.hooksPath` still reads `.husky/_` after any tool that installs hooks of
  its own, including every `bd` command.
- **`gh pr create`, never `--fill`.** `--fill` skips `PULL_REQUEST_TEMPLATE.md`, whose
  checkboxes carry the CLAUDE.md constraints.
- **Stage explicit paths.** Never `git add -A` after a tool has run. `git rm` stages too:
  a deletion staged before a `git add` of other paths rides into that commit. An
  unexpected modification to a governance file is a finding, not noise.
- **One session, one PR.** A finding that surfaces mid-session and is not blocking gets a
  bead, not a new branch. Work not attached to a session gets its own small PR.
- **Separate commits per logical change.** Merge with a merge commit rather than a
  squash: the commit history is part of the artifact.

---

## Known gaps in this document

Stated rather than smoothed over.

- **What regenerating from the template changed.** *Where we've been* is now a map from
  session to PR that points at `CHANGELOG.md`, rather than a second narrative of each
  session; the previous handoff carried both and they had begun to diverge. *Where
  outstanding work lives* names only the beads that qualify a claim, per the template as
  corrected in #33, and states the beads' locality as something verified this session
  rather than described. The containment amendment of 2026-09-09 is not reproduced: its
  full text, including the inventory of what the public ref carried by id and category,
  is in the handoff at commit `2dbdcb1`, and that is its canonical home now. Its
  conclusions stand: the unreachable objects remain on GitHub until GitHub's own garbage
  collection, no purge was requested, and that was the owner's decision on stated
  reasoning. The bead count, which the previous handoff had wrong, is re-read from
  `bd stats`.
- **The model's behaviour under the prompt is unverified.** Two live calls in session 5
  and none in session 6. Prompt injection inside a note delimiter, an attendee's claim
  adopted as the sender's, and the classifier's error rates all wait for session 7's
  runner. `fieldnote-08m`, `fieldnote-ay2`.
- **The truncation and refusal paths have never fired against the real API.** Mocked
  SDK only, and now a mocked route in the end-to-end suite.
- **The greeting is composed from the display name as entered, and that is all the
  record holds.** Fixed between sessions 6 and 7 (`fieldnote-viw`, prompt template
  1.1.0): "Dear Dr. Okonjo-Baptiste," from the record, in place of the model's token
  greeting, which rehydrated to a bare surname. `AttendeeRecord` has no title field; the
  form is whatever the representative typed. Session 8's roster import is where
  structured fields would arrive, and the composition takes the record so it can use
  them then.
- **The hardware run is one phone, one day, iOS 26.6.1.** Nothing built in sessions 5 or
  6 has been run on hardware. The clipboard write and the CSV download in the review
  surface are the two things most likely to behave differently on iOS.
- **The layout validation is one observed session**, `fieldnote-xjs`, closed. The review
  surface is a second view on that layout, not a change to it, and has not been observed
  in use.
- **Storage durability across Safari's eviction window is untested.** `fieldnote-bdw`.
- **Nothing is deployed.** `fieldnote-6x5`, `fieldnote-ijg`.
- **The private fork has no session and this handoff has no visibility into it.**
  `fieldnote-v2s`.
- **The dictation evidence is two small samples**, and one observed pair is deliberately
  not in the public documents.
- **Audit records grow without bound.** Small, hash-only, and by design (ADR-0008); the
  retention policy session 16 owes must say what happens to them.
- **The `Verify` job's cost** is measured on a handful of runs, around a minute and a
  half with the end-to-end suite; nothing here records it more precisely.
- **A name with neither a title nor a roster entry is still missed**, and so is a role
  outside the closed head-noun list or written mid-sentence without a determiner.
  ADR-0006 and ADR-0007 state both.
- **Session-to-PR attribution before session 2 is partly inferred** from commit messages.
- **Hours in the build guide are estimates, not measurements.**

---

## How to use this

**Regenerate, do not edit.** Write each handoff by re-reading the sources — `git log`,
the build guide, `CLAUDE.md`, `docs/adr/README.md`, `bd ready`, `bd blocked`, and the
open GitHub issues.

**Point, do not copy.** Anything with a canonical home gets a pointer.

**Every claim traceable.** To a file, a commit, or a command run while writing. If it is
not, say so in *Known gaps* rather than dropping it silently or asserting it anyway.
