# Handoff

Written 2026-09-02, at `c33a5e0` on `main`.

Every claim here was checked against the repository, git history, the trackers, or the
GitHub API in the session that wrote it. Where something could not be verified, it says
so rather than smoothing over the gap.

Regenerate this document from `docs/HANDOFF-TEMPLATE.md` at the end of each session, by
re-reading the sources. Do not edit the previous handoff in place — a handoff written
from the last handoff drifts from the repository it describes.

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
control is expected to be *enforced*, not asserted — the denylist runs in a pre-commit
hook and in CI, the data-access boundary is a failing test rather than a convention, and
where a control cannot be enforced the documentation says so plainly. `CLAUDE.md`
carries the non-negotiable constraints; they are not preferences, and a change that
violates one is wrong regardless of how well it is implemented.

---

## Where we've been

33 commits on `main`, 10 merged pull requests, no open ones. Verified with
`git rev-list --count main` and `gh pr list`.

**Phase 0 — foundation.** Build guide session 1. The Next.js 16 scaffold, CI, and the
security baseline landed first as two direct commits (`989d459`, `d509dca`), then
through PRs: **#6** repository hygiene and secret scanning, **#7** replacing the
unmaintained `xlsx` dependency, **#8** adopting the Next 16 tsconfig changes. Dependabot
PRs **#1**, **#2**, **#4** carried dependency bumps. PRs **#3** and **#5** were closed
rather than merged — see *What's next*.

**Documentation consolidation.** **#9** revised the plan and build guide to record
Phase 0 as shipped, moved both into `docs/`, and added ADR-0004 and ADR-0005 with the
ADR index. **#10** verified ADR-0004's full-disk-encryption premise and converted
ADR-0005's single-egress claim into a CI check owed at session 5.

**Session 2 — data layer and persistence.** **#12**, four commits. Dexie schema for the
eight entities in plan §5 plus an internal session-marker table; migration scaffolding
from v1; a single data-access layer under `src/lib/db/` that is the only place Dexie is
imported; `encrypt`/`decrypt` hooks as identity pass-throughs per ADR-0004; every schema
field classified encryption-eligible or clear; debounced autosave; and crash recovery
with an explicit recovered-session state. Six test files now exist under `tests/`.

**Beads.** **#13** set up the internal issue tracker. Most of that PR is not the tracker
— `bd init` repointed `core.hooksPath` away from `.husky/`, silently disabling the
denylist and gitleaks pre-commit gate, and rewrote instructions in `CLAUDE.md`. The PR
restores the gate, chains beads behind it, and records both findings as beads.

---

## Where we are

`main` is at `c33a5e0`. Working tree clean, no open pull requests, CI green on the last
three merges to `main` (`gh run list --branch main`).

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on and force pushes
disabled. Required approving reviews: **0**, which is deliberate for a single-maintainer
repository but worth knowing: the gate is CI, not review.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests, and build, and those are real. Two caveats matter more than the badge:

- **The eval suite passes against zero cases.** `scripts/evals.mjs` prints
  `evals: no cases defined yet (scaffold placeholder)` and exits 0. Every green
  "Adversarial guardrail suite" check since PR #7 is evidence that the wiring works, not
  that any guardrail holds. It is also a *required* check, so the gate currently proves
  nothing about guardrails. Real cases land at session 7. No eval badge in the README
  before then.
- **CI enforces structural denylist patterns only.** The literal-term list lives in
  `.denylist.local`, which is gitignored by design and therefore absent on a runner. CI
  cannot catch a real name in a diff; only the local pre-commit hook can. This is stated
  in `.github/workflows/ci.yml` and in the header of `scripts/check-denylist.mjs`.

**Documentation set.** `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`, five ADRs with an
index at `docs/adr/README.md`, plus `CHANGELOG.md` and `SECURITY.md` at the root. Plan
§4.6 also specifies `README.md`, `docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`,
`docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, and `docs/COMPLIANCE-MAP.md` — **none
of which exist yet.** Most are scheduled for Phase 4. The README is not: session 1's
stated done-when includes "both badges render in the README", and there is no README, so
that criterion is unmet. Whether that matters before session 18 is a judgement call, not
something this handoff should decide.

---

## What's next

### Session 3 — capture UI and offline shell

Read `docs/BUILD-GUIDE.md` session 3 in full before starting; this is a pointer, not a
substitute. Budgeted at ~4 hours.

Port the prototype's capture dock and log onto the session 2 data layer. The design is
already validated — rebuild it with proper components and types rather than redesigning
it. Plus the service worker and PWA manifest (plan §5, non-negotiable 5), budgeted at
about an hour of the four, which land here because capture is the first thing that has
to survive a dead signal.

Capture is also where dictated text arrives. Per ADR-0005 the application records no
audio and knows nothing about dictation, but the textarea has to be comfortable to
*correct* text in, one-handed and standing up.

**Done when** capture works after a hard reload with the network disabled — not merely
with the network toggled off on an already-loaded page, which passes without a service
worker and proves nothing.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — internal build state.** Findings, deferred decisions, open questions. 18
issues. Run `bd ready` for what is actionable and `bd blocked` for what is waiting and
on what. Four session-container beads (7, 15, 16, 19) exist only to hang dependency
edges from and are deferred so they do not compete with real work. This handoff
deliberately does not list them: a handoff that copies the tracker drifts from it.

**GitHub issues — public record.** Anything a public reader should see. One open: **#11**,
migrating ESLint to flat config and upgrading `eslint-config-next` to 16.x. It is
blocked on a migration rather than a version bump, and Dependabot registered an ignore
for the version when PR #3 was closed, so it will not resurface on its own. PR #5
(TypeScript 6.0.3) was closed the same way and has the same problem.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`. Records are immutable
once accepted: superseded by a new record when a decision changes, amended in place with
a dated note when a consequence is added. Session 2 deferred one ADR that is now a bead
— audit records surviving event deletion.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means. A session brief is a summary
  of it, and summaries drop the constraint that mattered.
- **The constraints in `CLAUDE.md` are not optional.** If a task requires violating one,
  stop and say so rather than finding a way around it. The constraint is the point.
- **Never `--no-verify`.** If the pre-commit hook fires, stop and show the output. The
  hook has caught real leaks more than once, and it is the only gate that sees the
  literal-term denylist.
- **`gh pr create`, never `--fill`.** `--fill` skips `PULL_REQUEST_TEMPLATE.md`, whose
  checkboxes carry the CLAUDE.md constraints, and the PR then has to be rewritten by
  hand.
- **One session, one PR.** A finding that surfaces mid-session and is not blocking gets
  a bead, not a new branch. Amend documents when the session that changes them lands,
  not on discovery.
- **Separate commits per logical change.** Merge with a merge commit rather than a
  squash: the commit history is part of the artifact, and squashing flattens the
  reasoning into one line.

---

## Known gaps in this document

Stated rather than smoothed over.

- **Session-to-PR attribution before session 2 is partly inferred.** Commits and PRs are
  quoted from `git log` and `gh pr list` and are accurate, but the build guide does not
  record which PR closed which session, so the grouping under *Where we've been* is a
  reading of commit messages rather than a recorded fact.
- **The ADR index is stale.** `docs/adr/README.md` marks ADR-0003 as "Accepted, amended
  2026-09-01" but shows ADR-0004 and ADR-0005 as plain "Accepted", though both carry
  dated `Amended` lines in their own headers. The records are correct; the index is not.
- **Hours in the build guide's phase table are estimates, not measurements.** Nothing in
  this repository records actual time spent, so no claim is made about whether Phase 0
  and session 2 landed within their budgets.
- **This handoff does not verify the private fork.** It has no visibility into whether
  one exists or what state it is in.
