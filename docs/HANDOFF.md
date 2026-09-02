# Handoff

Written 2026-09-02, at `15bd014` on `feat/session-4-privacy-boundary`. `main` is at
`7a7bdf8`; this branch is session 4 and is not merged at the time of writing.

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

57 commits on `main`, 15 merged pull requests, none open. Verified with
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

**Session 3 — capture UI and offline shell.** **#15**, thirteen commits, merged at
`7c09831`. The capture dock and log on the session 2 data layer; the PWA manifest and a
hand-written service worker; e2e coverage of both; the previously untested
`resumeSession` path; a gitignored `private/` path for pre-de-branding material; and
document amendments. Six of the thirteen commits are review findings fixed in place — a
viewport scale lock that failed WCAG 1.4.4, a service worker that could never update, an
autosave `flush` that resolved while a write was still running, a CodeQL missing-await,
and the discovery that the capture screen had no path to a second event. The data layer
and the schema had supported several all along — `createEvent` and `listEvents` were
unconstrained from session 2, and `Settings.activeEventId` had sat there unused since
then — so the single-event assumption was the new UI's, not the design's.

The session did **not** do what the build guide told it to. The guide says to port an
already-validated prototype and not to redesign it; that prototype was a Claude artifact
built outside this repository, it was not retrieved, and the capture surface was built
from plan §3.1 instead. The guide and §3.1 were amended in the same PR, and the layout is
tracked as unvalidated in `fieldnote-xjs`. Nothing here should describe it as ported.

**Session 4 — the privacy boundary.** Three commits on
`feat/session-4-privacy-boundary`, not yet merged. `src/lib/privacy/` with roster matching,
structural name detection, and a guard on the API client; dictation fixtures in their own
commit with per-case provenance; and ADR-0006 recording what changed about the boundary's
meaning.

The session's substantive addition is structural detection: a token following a title is a
name whether or not the roster knows it. Roster matching alone is fail-open by
construction — it cannot catch a name it was never told about, and dictation reliably
produces exactly that. ADR-0006 carries the reasoning, the rejected alternatives, and the
residual risk.

**Project inputs and the denylist.** Two small PRs after session 3, neither attached to a
build guide session. **#16** recorded plan §7 items 1 to 3 as received or resolved and
widened the rule governing how that material may be adapted into public eval cases —
previously names only, now product and commercial detail as well. **#17** removed
`public/` from the denylist's skip list, where a real name in a committed SVG would have
gone unscanned, and wrote the term check's literal-match limitation into the script
header.

---

## Where we are

`main` is at `7a7bdf8` with a clean working tree and no open pull requests; session 4 is
three commits ahead on its branch. CI green on the last three merges
(`gh run list --branch main`).

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, which is deliberate for a single-maintainer repository but worth knowing:
the gate is CI, not review. Required conversation resolution is not decorative — it
blocked #15 on an unresolved CodeQL thread after every check was already green.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests, and build, and those are real. Four caveats matter more than the badge:

- **The eval suite passes against zero cases.** `scripts/evals.mjs` prints
  `evals: no cases defined yet (scaffold placeholder)` and exits 0. Every green
  "Adversarial guardrail suite" check since PR #7 is evidence that the wiring works, not
  that any guardrail holds. It is also a *required* check, so the gate currently proves
  nothing about guardrails. Real cases land at session 7.
- **CI enforces structural denylist patterns only.** The literal-term list lives in
  `.denylist.local`, which is gitignored by design and therefore absent on a runner. CI
  cannot catch a real name in a diff; only the local pre-commit hook can.
- **The local hook catches listed spellings, not names.** Terms compile to
  case-insensitive regexes with word boundaries, so a name split across words, missing a
  letter, or carrying a trailing plural passes clean — verified, not assumed. Device
  dictation mangles surnames by design, so text derived from `private/dictated-notes.md`
  is precisely what this cannot see, and from session 4 the tokenizer fixtures and eval
  corpus are made of that text. Human review of those diffs is the control; the hook is
  the backstop. `fieldnote-ech`, which also owes session 15 a threat-model entry.
- **The service worker's update path is not covered by any test.** Verified by hand
  twice; the worker's own header says so, and `fieldnote-unp` carries the procedure.

**The privacy boundary now exists**, ahead of the route that will cross it. Names are
replaced by roster matching and by a structural rule — a token after a title is a name
whether or not the roster knows it — and `assertPseudonymized` re-derives what a name looks
like rather than trusting that the tokenizer ran, so removing the structural pass makes a
test fail. That counterfactual is demonstrated in the suite, not asserted.

Two things about it are worth carrying forward rather than rediscovering. It
over-tokenizes on purpose: a tokenized non-name costs an odd sentence in a draft a human is
about to read, a missed name sends identity to a third party, and ADR-0006 records that as
a decision. And fail-closed means tokenizing more, never refusing to draft — nothing in the
module can surface an error to the representative, because a tool that errors in a car park
is one that stops being used.

**What the offline claim rests on.** Plan §5 non-negotiable 5 is met and was verified the
hard way rather than by toggling a browser switch: with the app loaded and a note
captured, the server process was killed, a page fetch to the origin was confirmed
refused, the HTTP cache was disabled, and a full reload still rendered the capture screen
with the note intact and accepted a new one. `tests/e2e/offline.spec.ts` is the automated
form, and it was confirmed to fail when the worker is replaced with one that activates
but caches nothing.

The update path was found broken under review and fixed in the same PR. The worker had
been hand-written and byte-identical across builds, so a browser never re-installed it
and a user stayed on whichever build they first loaded, indefinitely. `public/sw.js` is
now generated from `src/sw/service-worker.js` with the build id stamped in, caches are
named per build, and navigations fetch with `cache: "reload"` because the browser's own
HTTP cache was a second, independent way to be pinned. Verified by deploying twice.

Two limits remain: the worker registers in production builds only, so `next dev` has no
offline behaviour by design; and whether the generated `public/sw.js` and
`public/precache.json` survive a Vercel deploy is **unverified** — `fieldnote-6x5`.

**Project inputs.** Plan §7 items 1 and 2 have arrived and live at `private/`, which is
gitignored: eight writing samples and seven uncorrected dictated notes. Item 3 is
resolved; item 4 — what approved content actually exists, needed by session 9 — is the
only one still open. Two caveats travel with the material. The email samples' three-line
preambles are not filled in, so they teach register but not personalisation, which is the
ceiling the build guide already names for session 5. And per §7 as amended, anything
adapted from either file into public eval cases has names **and product and commercial
detail** replaced — product characteristics, pricing comparisons, and indication status
each identify the manufacturer to an industry reader with every name already gone.

**Documentation set.** `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`, five ADRs with an
index at `docs/adr/README.md`, this handoff and its template, plus `CHANGELOG.md` and
`SECURITY.md`. Plan §4.6 also specifies `README.md`, `docs/ARCHITECTURE.md`,
`docs/AI-SYSTEM-CARD.md`, `docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, and
`docs/COMPLIANCE-MAP.md` — **none of which exist yet.** Most are scheduled for Phase 4.
The README is not: session 1's stated done-when includes "both badges render in the
README", and there is no README, so that criterion is unmet.

---

## What's next

### Session 5 — Generation route, guardrails, and headers

Read `docs/BUILD-GUIDE.md` session 5 in full before starting; this is a pointer, not a
substitute. Budgeted at ~3.5 hours, of which about 45 minutes is the security headers and
about 30 the egress check.

A server-side route handler, prompt templates and guardrail rulesets as versioned modules,
per-person batching with accumulated openings, and the retry and truncation handling from
the prototype fix. Plus CSP, SRI, and strict security headers, asserted in a test against a
live response rather than left in a config nobody reads. Plus the single-egress check in
CI — a grep over `src/` with the model route as the only allowed destination, which catches
the careless case rather than the determined one and should be cited with that limit
attached.

**Done when** drafts generate end to end with names tokenised in the API payload and
correct in the UI, a test asserts the headers on a real response, and the egress check goes
red when a second destination is added — verified by adding one temporarily.

Three things session 4 hands it. Everything crossing to the model goes through
`createPseudonymizer` and then `assertPseudonymized`; the guard is an internal invariant,
so session 5 owns making a throw surface as a defect report to the developer rather than as
a failure to the representative. Token stability across a batch comes from reusing one
pseudonymizer instance, which is what per-person batching needs. And `fieldnote-q0h` —
roles are not tokenised — should be decided before generation is wired up, because a role
reaching the model is the same failure as a name reaching it.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — internal build state.** Findings, deferred decisions, open questions. 31
issues: 23 open, 4 closed, 4 deferred, with 10 ready. Run `bd ready` for what is
actionable and `bd blocked` for what is waiting and on what. Session-container beads
exist only to hang dependency edges from and are deferred so they do not compete with
real work. This handoff deliberately does not list them: a handoff that copies the
tracker drifts from it.

Four are worth naming because they qualify claims made above. `fieldnote-q0h` — role
references identify people and the tokenizer does not see them, which is the largest
remaining hole in §4.1. `fieldnote-xjs` — the capture layout is unvalidated.
`fieldnote-bdw` — the iOS install path and Safari's storage eviction are unverified and the
availability argument rests on them; it blocks `fieldnote-tcq`, because a retention policy
cannot be chosen without knowing whether eviction deletes first. `fieldnote-ech` — the
denylist matches listed spellings only.

**GitHub issues — public record.** Anything a public reader should see. One open: **#11**,
migrating ESLint to flat config and upgrading `eslint-config-next` to 16.x. It is blocked
on a migration rather than a version bump, and Dependabot registered an ignore for the
version when PR #3 was closed, so it will not resurface on its own. PR #5 (TypeScript
6.0.3) was closed the same way and has the same problem.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`. Records are immutable
once accepted: superseded by a new record when a decision changes, amended in place with
a dated note when a consequence is added. Session 2 deferred one ADR that is now a bead —
audit records surviving event deletion. **ADR-0006** landed in session 4, recording that
the pseudonymization boundary is roster matching plus structural detection plus a
fail-closed guard, with the over-tokenizing asymmetry and the rejected alternatives. Two
more are owed but not yet due. When
`fieldnote-bdw` resolves, ADR-0004 gains a dated note, because that record accepted
residual risk at rest on confidentiality grounds and storage eviction is a second
residual risk in the same territory on the availability axis. And the substance of the §2
conversation, when it exists, likely belongs in an ADR rather than a §7 status line,
because it constrains what the private fork may do.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means. A session brief is a summary
  of it, and summaries drop the constraint that mattered.
- **Verify the guide's premises before building on them.** Session 3's instruction to
  port a validated prototype rested on an artifact that no longer existed. A guide entry
  is a plan written earlier, not a fact about the repository now, and where the two
  disagree the repository wins and the guide gets amended in the session that found it.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Session 3 shipped a service worker whose commit message described cache
  versioning that in practice never ran a second time. Where something genuinely cannot
  be covered, say so in the file itself rather than letting a green suite imply otherwise.
- **Check existence and ignore status separately.** `git check-ignore` is a pattern
  query: it reports a match whether or not the file exists. Used alone it will "confirm"
  files that are not there, which happened once already when material turned out to be a
  directory deeper than expected.
- **The constraints in `CLAUDE.md` are not optional.** If a task requires violating one,
  stop and say so rather than finding a way around it. The constraint is the point.
- **Never `--no-verify`.** If the pre-commit hook fires, stop and show the output. The
  hook has caught real leaks more than once, and it is the only gate that sees the
  literal-term denylist. Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks of its own.
- **`gh pr create`, never `--fill`.** `--fill` skips `PULL_REQUEST_TEMPLATE.md`, whose
  checkboxes carry the CLAUDE.md constraints, and the PR then has to be rewritten by hand.
- **One session, one PR.** A finding that surfaces mid-session and is not blocking gets a
  bead, not a new branch. Amend documents when the session that changes them lands, not
  on discovery. Work not attached to a session — #16 and #17 — gets its own small PR.
- **Separate commits per logical change.** Merge with a merge commit rather than a
  squash: the commit history is part of the artifact, and squashing flattens the
  reasoning into one line.

---

## Known gaps in this document

Stated rather than smoothed over.

- **The capture layout has never been used by anyone.** It was built from a four-sentence
  feature list, not ported from the validated prototype, and every decision behind it —
  what sits where, how attribution is reached, what a log row shows — was invented in
  session 3 and is listed in the #15 body. `fieldnote-xjs` tracks getting it in front of
  the representative. Treat "capture works" here as "capture functions", not as "capture
  is right".
- **Nothing here has read the material in `private/`.** The counts and paths above come
  from the session brief and a filesystem check, not from the contents. Whether the
  samples have the range §7 asks for, and whether the notes carry the artifacts sessions
  4, 7, and 15 need, is unverified by this document.
- **The service worker update path has no automated coverage.** Verified manually, twice,
  and the procedure is written out in `fieldnote-unp`. Playwright's `webServer` builds
  once per run, so a two-build test needs a harness this repository does not have.
- **The Vercel deploy path for the offline shell is untested.** Both `public/sw.js` and
  `public/precache.json` are written after `next build` finishes, and nothing here
  confirms Vercel collects them. Verified locally and under Playwright only.
  `fieldnote-6x5`.
- **The backgrounded-tab e2e emulates `visibilitychange` rather than producing it.** A
  headless browser will not reliably background a tab, so the event is dispatched. The
  state machine underneath is covered directly in `tests/unit/session-lifecycle.test.ts`.
- **`useDebouncedAutosave` has no unit test.** Session 3 fixed a real race in it — `flush`
  resolving while a write was still in flight — and covered it only through an e2e,
  because a hook test needs a React testing library this repository does not have.
- **Plan §7 item 3 records a status with no substance.** It says the §2 conversation is
  resolved and nothing about what was described or approved, because that was not
  supplied. §2 gates the private build on the substance, so "resolved" is not yet enough
  to act on.
- **Role references are not pseudonymised, and four of the seven available notes name
  nobody any other way.** In a single-institution note "the Biomed Director" identifies a
  person as certainly as a surname. The tokenizer does not see it, the tests say so
  explicitly rather than passing over it, and `fieldnote-q0h` carries the design shape. This
  is the largest remaining hole in plan §4.1's claim and it should be closed before
  generation is wired to the boundary.
- **The evidence for dictation mangling surnames is five names.** One severe failure
  (`Swali` → `Swelha`), four transcribed correctly. That establishes the failure exists and
  what shape it has — rare, so nobody is watching, and severe, so nothing approximate
  recovers it — and it cannot support a claim about frequency. The build guide states the
  behaviour more strongly than the evidence does; amending it is the owner's call.
- **A name with neither a title nor a roster entry is still missed.** The structural rule
  closes the common case, not the general one.
- **Session-to-PR attribution before session 2 is partly inferred.** Commits and PRs are
  quoted from `git log` and `gh pr list` and are accurate, but the build guide does not
  record which PR closed which session, so the grouping under *Where we've been* is a
  reading of commit messages rather than a recorded fact.
- **Hours in the build guide's phase table are estimates, not measurements.** Nothing in
  this repository records actual time spent, so no claim is made about whether any session
  landed within its budget.
- **This handoff does not verify the private fork.** It has no visibility into whether one
  exists or what state it is in.
