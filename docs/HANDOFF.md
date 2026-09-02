# Handoff

Written 2026-09-02, at `bb4911b` on `feat/session-3-capture-ui`. `main` is at `9a7c1b0`;
this branch is session 3 and is not merged yet.

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

37 commits on `main`, 11 merged pull requests, none open. Verified with
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
with an explicit recovered-session state.

**Beads.** **#13** set up the internal issue tracker. Most of that PR is not the tracker
— `bd init` repointed `core.hooksPath` away from `.husky/`, silently disabling the
denylist and gitleaks pre-commit gate, and rewrote instructions in `CLAUDE.md`. The PR
restores the gate, chains beads behind it, and records both findings as beads.

**Handoff protocol.** **#14** added this document, `docs/HANDOFF-TEMPLATE.md`, and the
two `CLAUDE.md` working agreements behind them: regenerate the handoff from sources at
the end of every session, and prefer the plainly correct implementation.

**Session 3 — capture UI and offline shell.** Six commits on
`feat/session-3-capture-ui`, not yet merged. A gitignored path for private material; the
PWA manifest and a hand-written service worker with a generated precache manifest; the
capture dock and log built on the session 2 data layer; end-to-end coverage of the
capture surface and the offline shell; a test closing the untested `resumeSession` path;
and amendments to the build guide and the plan.

The session did **not** do what the build guide told it to. The guide says to port an
already-validated prototype and not to redesign it; that prototype was a Claude artifact
built outside this repository, it was not retrieved, and the capture surface was built
from plan §3.1 instead. The guide and §3.1 were amended in the same PR, and the layout is
tracked as unvalidated in `fieldnote-xjs`. Nothing in this repository should describe it
as ported.

---

## Where we are

`main` is at `9a7c1b0` with a clean working tree and no open pull requests; session 3 is
six commits ahead on its branch. CI green on the last four merges to `main`
(`gh run list --branch main`).

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict
up-to-date branches, and force pushes disabled. Required approving reviews: **0**, which
is deliberate for a single-maintainer repository but worth knowing: the gate is CI, not
review. Re-verified this session against the branch-protection API.

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

**What the offline claim rests on.** Plan §5 non-negotiable 5 is met and was verified the
hard way rather than by toggling a browser switch: with the app loaded and a note
captured, the server process was killed, a fetch to the origin was confirmed refused, the
HTTP cache was disabled, and a full reload still rendered the capture screen with the note
intact and accepted a new one. `tests/e2e/offline.spec.ts` is the automated form of the
same check, and it was confirmed to fail when `public/sw.js` is replaced with a worker
that activates but caches nothing — so it tests the worker rather than passing for free.

Two limits on that: the service worker is registered in production builds only, so
`next dev` has no offline behaviour by design; and whether the generated
`public/precache.json` survives a Vercel deploy is **unverified** and tracked as
`fieldnote-6x5`.

**Documentation set.** `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`, five ADRs with an
index at `docs/adr/README.md`, this handoff and its template, plus `CHANGELOG.md` and
`SECURITY.md` at the root. Plan §4.6 also specifies `README.md`,
`docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`, `docs/THREAT-MODEL.md`,
`docs/DATA-PROTECTION.md`, and `docs/COMPLIANCE-MAP.md` — **none of which exist yet.**
Most are scheduled for Phase 4. The README is not: session 1's stated done-when includes
"both badges render in the README", and there is no README, so that criterion is unmet.

---

## What's next

### Session 4 — The privacy boundary

Read `docs/BUILD-GUIDE.md` session 4 in full before starting; this is a pointer, not a
substitute. Budgeted at ~2–3 hours.

`src/lib/privacy/pseudonymize.ts`: stable tokenisation of names, rehydration, and a guard
that throws if an untokenised string reaches the API client. Unit tests including the
nasty cases — names inside note prose, possessives, initials, a surgeon sharing a surname
with a staff member — plus the dictation cases, which per ADR-0005 must be written from
real dictated notes rather than invented, because invented dictation artifacts are always
too tidy.

Build it **before** the generation route. The guide is explicit that if generation exists
first you will wire it up directly and retrofit the boundary, and retrofitted boundaries
leak. Session 3 held that line: capture writes notes, tokenises nothing, and calls no API.

**Done when** a test asserting no raw name can reach the API client passes, and fails if
you remove the guard.

Note the dependency: the dictation cases need plan §7 item 2, six to ten uncorrected
dictated notes, whose status is *to request*. The session can be built without them; its
test corpus cannot be finished without them.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — internal build state.** Findings, deferred decisions, open questions. 22
issues, 18 open. Run `bd ready` for what is actionable and `bd blocked` for what is
waiting and on what. Session-container beads exist only to hang dependency edges from and
are deferred so they do not compete with real work. This handoff deliberately does not
list them: a handoff that copies the tracker drifts from it. The one worth knowing about
without opening the tracker is `fieldnote-xjs`, because it qualifies a claim this document
makes — the capture layout is unvalidated.

**GitHub issues — public record.** Anything a public reader should see. One open: **#11**,
migrating ESLint to flat config and upgrading `eslint-config-next` to 16.x. It is
blocked on a migration rather than a version bump, and Dependabot registered an ignore
for the version when PR #3 was closed, so it will not resurface on its own. PR #5
(TypeScript 6.0.3) was closed the same way and has the same problem.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`. Records are immutable
once accepted: superseded by a new record when a decision changes, amended in place with
a dated note when a consequence is added. Session 2 deferred one ADR that is now a bead —
audit records surviving event deletion. Session 3 deferred none: its three document
amendments are corrections of fact and stack sequencing, not decisions.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means. A session brief is a summary
  of it, and summaries drop the constraint that mattered.
- **Verify the guide's premises before building on them.** Session 3's instruction to
  port a validated prototype rested on an artifact that no longer existed. A guide entry
  is a plan written earlier, not a fact about the repository now, and where the two
  disagree the repository wins and the guide gets amended in the session that found it.
- **The constraints in `CLAUDE.md` are not optional.** If a task requires violating one,
  stop and say so rather than finding a way around it. The constraint is the point.
- **Never `--no-verify`.** If the pre-commit hook fires, stop and show the output. The
  hook has caught real leaks more than once, and it is the only gate that sees the
  literal-term denylist. Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks of its own.
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

- **The capture layout has never been used by anyone.** It was built from a four-sentence
  feature list, not ported from the validated prototype, and every decision behind it —
  what sits where, how attribution is reached, what a log row shows — was invented in this
  session and is listed in the session 3 PR body. `fieldnote-xjs` tracks getting it in
  front of the representative. Treat "capture works" in this document as "capture
  functions", not as "capture is right".
- **Session-to-PR attribution before session 2 is partly inferred.** Commits and PRs are
  quoted from `git log` and `gh pr list` and are accurate, but the build guide does not
  record which PR closed which session, so the grouping under *Where we've been* is a
  reading of commit messages rather than a recorded fact.
- **The ADR index is still stale.** `docs/adr/README.md` marks ADR-0003 as "Accepted,
  amended 2026-09-01" but shows ADR-0004 and ADR-0005 as plain "Accepted", though both
  carry dated `Amended` lines in their own headers. Re-verified this session and unchanged
  since the last handoff; tracked as `fieldnote-fpm`.
- **The Vercel deploy path for the offline shell is untested.** `public/precache.json` is
  written after `next build` finishes, and nothing here confirms Vercel collects it.
  Verified locally and under Playwright only. `fieldnote-6x5`.
- **The backgrounded-tab e2e emulates `visibilitychange` rather than producing it.** A
  headless browser will not reliably background a tab, so the event is dispatched. The
  state machine underneath is covered directly in `tests/unit/session-lifecycle.test.ts`;
  what the e2e proves is that the app's listeners are wired to the right calls.
- **Hours in the build guide's phase table are estimates, not measurements.** Nothing in
  this repository records actual time spent, so no claim is made about whether any session
  landed within its budget.
- **This handoff does not verify the private fork.** It has no visibility into whether
  one exists or what state it is in.
