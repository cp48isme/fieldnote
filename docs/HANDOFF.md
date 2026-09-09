# Handoff

Written 2026-09-10, at `077b64c` on `main`, between sessions 5 and 6.

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
hook and in CI, the data-access boundary and the single-egress claim are failing tests
rather than conventions, the security headers are asserted against a live response, and
where a control cannot be enforced the documentation says so plainly. `CLAUDE.md`
carries the non-negotiable constraints; they are not preferences, and a change that
violates one is wrong regardless of how well it is implemented.

---

## Where we've been

118 commits on `main`, 27 merged pull requests, one open. Verified with
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

**Session 2 — data layer and persistence.** **#12**. Dexie schema for the eight entities
in plan §5 plus an internal session-marker table; migration scaffolding from v1; a single
data-access layer under `src/lib/db/` that is the only place Dexie is imported;
`encrypt`/`decrypt` hooks as identity pass-throughs per ADR-0004; every schema field
classified encryption-eligible or clear; debounced autosave; and crash recovery with an
explicit recovered-session state.

**Beads.** **#13** set up the internal issue tracker, and restored the pre-commit gate
that `bd init` had silently repointed `core.hooksPath` away from.

**Handoff protocol.** **#14** added this document, its template, and the two `CLAUDE.md`
working agreements behind them.

**Session 3 — capture UI and offline shell.** **#15**, merged at `7c09831`. The capture
dock and log, the PWA manifest and a hand-written service worker, e2e coverage of both.
The session did **not** port the validated prototype the guide described, because that
artifact no longer existed; the capture surface was built from plan §3.1 and is tracked
as unvalidated in `fieldnote-xjs`.

**Project inputs and the denylist.** **#16** recorded plan §7 items 1 to 3 and widened
the rule for adapting private material into public eval cases to cover product and
commercial detail. **#17** removed `public/` from the denylist's skip list. **#18**
regenerated this handoff.

**Session 4 — the privacy boundary.** **#19**, merged at `8445e5f`. `src/lib/privacy/`
with roster matching, structural name detection, and a guard on the API client; dictation
fixtures with per-case provenance; ADR-0006.

**The first device run.** **#20** made data-layer failures visible and refused insecure
origins up front. **#21** added `pnpm serve:https`. **#22** stopped `next dev` writing to
`CLAUDE.md`. **#23** regenerated this handoff. **#24** moved the session prompts into
`docs/prompts/` and resolved two conflicts between `CLAUDE.md` and the guide. **#25**
recorded that session 5's budget was understated.

**The certificate trust flow and the first full hardware run.** **#28** replaced a
self-signed leaf with a small certificate authority, because iOS will not trust a leaf.
**#29** recorded the owner's and the representative's walk of the whole flow on an
iPhone, iOS 26.6.1. **#30** split session 5's first gate into what hardware answered
(1a, met) and what is still owed (1b, an observed session with the representative).
**#31** fixed the session 5 prompt before it was sent.

**Session 5 — generation route, guardrails, and headers.** **#32**, twenty-four commits,
merged at `077b64c` on 2026-09-09. In order:

- The prompt file replaced with the version actually sent, after the session's
  verification pass stopped the first version on four premises the repository could not
  support (`docs/prompts/session-5.md` records all four and how they were resolved).
- **Roles at the boundary**, per ADR-0007: a role on the roster shares the rostered
  person's token; a role the roster does not know is found structurally and gets its own
  `[ROLE_n]`; plurals and indefinite references are left alone; rehydration is per
  occurrence. Tokens are now issued per identity, so every form of one person shares a
  token. The test that had asserted roles were a known gap now asserts the opposite,
  deliberately.
- **Generation**: a versioned prompt template, a versioned guardrail ruleset with an
  adversarial Vitest case and a counterfactual per rule, a per-person batching pipeline
  with accumulated openings on one pseudonymizer instance, and the API client that is the
  application's one network call.
- **The route**: stateless, validated with zod, the structural half of the guard as
  defence in depth, `claude-opus-5` in one constant, SDK retries, one retry at a doubled
  ceiling on truncation, a block on a second truncation or a refusal, metadata-only
  logging.
- **Security headers**: a proxy minting a per-request nonce, a Content Security Policy
  with `connect-src 'self'`, SRI, and the strict static headers, asserted against a live
  response by `tests/e2e/headers.spec.ts`.
- **The single-egress check**, `tests/unit/single-egress.test.ts`, verified red by adding
  a second destination and green on removing it.
- A **throwaway generation UI** — one button, one in-memory list — as the pipeline's
  proof, with `fieldnote-aev` recording that session 6 deletes it.
- Guide amendments for sessions 5, 6, and 7; the how-it-went note on the prompt; the
  handoff.
- **Review follow-up**, three commits. The guardrail ruleset moved to **1.1.0**: an
  attributed question passes, an attributed assertion does not, and the sender answering
  in the same sentence blocks. Site- and product-specific terms the model must never write
  now load at runtime in the route from a gitignored `.guardrail-terms.local` (template
  committed), so nothing from the private denylist reaches the public ruleset;
  `fieldnote-quj` records that the two rulesets differ. And a hallucinated roster name in
  the model's output withholds that one draft under its own outcome, `output-blocked`,
  instead of riding into the next request and blocking every recipient after it as a
  tokenizer defect.
- **Second pass, four commits.** The end-to-end suite joined the `Verify` job.
  `CHANGELOG.md` tracks sessions, as a working agreement in `CLAUDE.md`, and session 5's
  entry is in it; the backfill for sessions 2 to 4 is `fieldnote-dus`, its own PR. And a
  second working agreement: findings about the private material are recorded in beads,
  with the public record pointing at them — the detail of the denylist collision moved
  into `fieldnote-quj` under it. Both owner decisions from the review are closed. One
  slip in the record: the two agreements landed in one commit rather than two.
- **Containment, in the same PR.** The beads database was found to be publishing to the
  public remote on every write. The remote was removed, the ref deleted, the agreement
  that had assumed beads were private replaced, and the exposure inventoried. The
  amendment under *Known gaps* is the record.

**Between sessions 5 and 6.** The PR carrying this handoff. Gate 1b closed:
`fieldnote-xjs` now carries the owner's note that the representative was observed using
the capture surface and found the layout right, and is closed; the one thing she reached
for that is not there is a feature, `fieldnote-g7d`. The changelog backfill for sessions 2
to 4 and the first device run landed (`fieldnote-dus` closed). Dependabot PR **#27** was
closed with the reason on it. Every merged branch was deleted on both sides.

Two live calls were made against the model, both accepted by the API: one to the route by
hand, one through the UI with the request intercepted to show that only tokens crossed.

---

## Where we are

`main` is at `077b64c` with a clean working tree. One pull request is open, Dependabot's
**#26**, the minor-and-patch group. **#27**, `eslint-config-next` 16.3.4, was closed on
2026-09-10 with the reason on it: it is the flat-config migration issue #11 tracks, not a
version bump, and PR #3 was the same upgrade earlier. CI green on the last merge to `main`
(`gh run list --branch main`). The only branches on the remote are `main` and #26's.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, deliberate for a single-maintainer repository: the gate is CI, not review.
Verified against the branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests, build, and — since the session 5 review — the end-to-end suite: the security
headers asserted on a live response, the offline shell after a hard reload with the
network gone, capture, persistence, crash recovery, and the environment gates. Those are
real. The caveats matter more than the badge:

- **The eval suite passes against zero cases.** `scripts/evals.mjs` still prints
  `evals: no cases defined yet (scaffold placeholder)` and exits 0. Every green
  "Adversarial guardrail suite" check is evidence that the wiring works, not that any
  guardrail holds — and it is a *required* check. What session 5 added instead is
  adversarial cases as Vitest tests under `pnpm test`, each with a counterfactual that
  removes the rule and watches the sentence pass through. Those verify the *ruleset*.
  They do not verify the *model's behaviour under the prompt* — whether it obeys an
  instruction inside a note, whether it adopts an attendee's claim — and nothing in the
  repository can until session 7's runner exists. `fieldnote-08m` and `fieldnote-034`.
- **The single-egress check is a grep.** It catches the careless case — an analytics
  SDK, a CDN font, a transcription service — and not the determined one: a URL assembled
  from parts, a fetch behind a wrapper, a dependency phoning home from `node_modules`.
  Cite it with that limit attached. `connect-src 'self'` in the CSP is the
  browser-enforced complement, and session 15 is scheduled to tighten both.
- **SRI is partial.** Next's `experimental.sri` puts `integrity` on the entry scripts and
  the polyfill, not on the client-component chunks React preloads from the RSC manifest,
  under Turbopack or webpack — verified by building with both. `fieldnote-9gp`. The e2e
  spec asserts what is covered and that every uncovered script is a same-origin chunk;
  it does not claim full coverage because that would be false.
- **The claim-bearing classifier is a heuristic.** Product noun plus descriptor or a
  comparison, in the sender's voice, blocks the sentence; attribution to the recipient
  passes it, and since 1.1.0 so does a comparison inside the recipient's own question,
  while an attributed assertion and an answer given in the same sentence still block. It
  will misclassify in both directions, its false-negative rate is unmeasured, and the
  review gate reads every draft. Session 9's library matcher replaces it.
- **The public ruleset is generic; the private fork's is not, and the difference is not
  reviewable here.** A finding about the private material sits in `fieldnote-quj`, per the
  working agreement in `CLAUDE.md`; the public record says only that it exists. The route now loads site- and product-specific terms at runtime from
  a gitignored file and blocks any sentence carrying one; absent on every public clone
  and CI runner, and logged as absent at start-up. `fieldnote-quj`.
- **The end-to-end suite runs on `127.0.0.1`, a secure context, in one browser.** It
  enters no environment that needs a trusted certificate authority, a home-screen
  install, or seven days of Safari's eviction window, and it says nothing about WebKit.
  Every hardware finding in this repository came from an environment the suite cannot
  reach.
- **CI enforces structural denylist patterns only.** The literal-term list lives in
  `.denylist.local`, gitignored by design and absent on a runner. Only the local
  pre-commit hook can catch a real name — and this session it caught two generic English
  nouns in the classifier's word lists that are also listed terms, which is the hook
  doing its job and a reminder that ordinary vocabulary can collide with the list.
- **The local hook catches listed spellings, not names.** A name split across words,
  missing a letter, or carrying a plural passes clean. `fieldnote-ech`; session 15 owes
  a threat-model entry.
- **The service worker's update path is not covered by any test.** `fieldnote-unp`.
- **The suite cannot enter every environment.** Playwright runs against `127.0.0.1`, and
  no harness here can trust a certificate authority, install to a home screen, or wait
  seven days for Safari's eviction window.

**The privacy boundary now covers roles.** Three passes: roster names, a token after a
title, and role references (ADR-0006, ADR-0007). One person is one token across name,
surname, initial-after-title, and role, within a note and across a batch. Text the
tokenizer produced rehydrates form for form; a draft rehydrates with canonical forms,
and a role token the model placed where a name would read better rehydrates faithfully
and reads oddly — a review-gate matter the owner accepted and ADR-0007 records. The
guard re-derives the role rule, so removing the role pass fails the suite. Residual
risks are ADR-0007's: a closed head-noun list, a role written mid-sentence without a
determiner, and an exclusion list that is a heuristic.

**Generation exists and crosses the boundary correctly.** Everything the model receives
has been through `createPseudonymizer` and `assertPseudonymized`; the route runs the
structural half again with no roster, because the roster never leaves the device. The
model is told what tokens are and that notes are data, is forbidden to describe the
product, and writes a literal gap marker where product language would go; the ruleset
replaces anything that slips with the same marker. There is no library to select from
until session 9, so **every claim-bearing sentence is blocked**, and drafts come back
with gratitude, logistics, and a visible gap. That is plan §4.2 working, observed early.

**The audit-record agreement is suspended, deliberately.** `CLAUDE.md` says no silent
generations; session 6 owns the records. The owner's resolution: session 5 generates
without records **and does not persist drafts** — they are held in memory and gone on
reload — so that no `DraftRecord` ever exists without an `AuditRecord` beside it.
Session 6 adds both in one change. The guide's session 5 and 6 entries record this.
`DraftOutcome` in `src/lib/generation/pipeline.ts` already carries `MODEL_ID`,
`PROMPT_TEMPLATE_VERSION`, `GUARDRAIL_RULESET_VERSION`, and `flagsFired` for it.

**Model output crosses the guard too.** A draft in which the model wrote a name or a role
it was never given is withheld under `output-blocked`, with an explanation to the
representative and nothing carried into the next request. `defect` is reserved for input
the tokenizer failed on, which is unreachable by construction and stays as the invariant.

**Truncation and refusal handling exists and has never fired live.** `MAX_OUTPUT_TOKENS`
is 4096 — about ten times the longest writing sample, with room for low-effort thinking
inside the same ceiling — chosen so that reaching it signals a runaway. Both blocks are
unit-tested against a mocked SDK; neither has been observed against the real one.

**The offline claim still holds under the new headers.** The page renders per request so
Next can stamp the nonce; the worker precaches that render with its header, and the
offline e2e passed unchanged. The generation route is excluded from the cache by the
worker, as it has been since session 3.

**The generation UI is a throwaway.** `src/components/capture/DraftList.tsx` and the
button in `CaptureScreen`: the pipeline's proof, not the review surface. It persists
nothing and shows nothing after a reload. `fieldnote-aev`. The add-person form records a
display name only, so anyone added there classifies as `STAFF` and has no role for the
roster-role pass to match; roster import (session 8) is where roles and specialties
arrive.

**The capture layout is validated.** Gate 1b, owed since session 3, is met: the
representative was observed using the surface and confirmed the layout — log above, dock
below, row contents, where attribution sits. `fieldnote-xjs` carries the owner's note and
is closed. What she reached for that is not there is the pre-meeting briefing package,
`fieldnote-g7d`, a feature rather than a layout problem, and the first feature request the
project has had from its user. It needs an ADR before anything is built, because the
briefing is a document that leaves the device.

**Documentation set.** `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`,
`docs/TESTING-ON-DEVICE.md`, seven ADRs with an index at `docs/adr/README.md`,
`docs/prompts/`, this handoff and its template, plus `CHANGELOG.md` and `SECURITY.md`.
Plan §4.6's `README.md`, `docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`,
`docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, and `docs/COMPLIANCE-MAP.md` do not
exist yet. `CHANGELOG.md` tracks sessions, as a working agreement in `CLAUDE.md`: one entry per
merged session PR, written with the handoff. Sessions 2 to 5 and the first device run are
all in.

---

## What's next

### Session 6 — Audit log and review gate

Read `docs/BUILD-GUIDE.md` session 6 in full before starting; this is a pointer, not a
substitute, and the entry now carries a dated amendment listing what session 5 deferred
to it. Budgeted at ~2–3 hours. Immutable audit records, a draft state machine with export
gated on review, and edit-distance capture between generated and exported text.

**Done when** every generation writes a record, export is impossible from `generated`
state, and the audit log exports to CSV.

**Three things session 5 hands it.** Draft persistence and the audit record land
together, in one change, restoring the no-silent-generations agreement; the versions and
flag ids the schema needs are already produced by the pipeline. The throwaway UI is
deleted and replaced by the review surface (`fieldnote-aev`). And **gate 1b no longer
blocks the review surface**: it was met on the observed session recorded in
`fieldnote-xjs`, closed. The review surface can build on the capture layout as it stands;
what it should read first is `fieldnote-g7d`, so that the pre-meeting path she asked for
is designed against rather than discovered again.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local since 2026-09-09.** Findings, deferred decisions, open
questions — but see the containment amendment under *Known gaps*: until that day the
database pushed to the public remote on every write, and nothing private may go into a
bead until a private place is verified to exist. 42
issues: 30 open, 11 closed, 4 deferred, with 18 ready and 12 blocked (`bd stats`). Run
`bd ready` for what is actionable and `bd blocked` for what is waiting and on what.
Session-container beads exist only to hang dependency edges from and are deferred so they
do not compete with real work. This handoff deliberately does not list them.

Thirteen are worth naming because they qualify claims made above. `fieldnote-g7d` — the
pre-meeting briefing package, the representative's own request, P1 because the document
leaves the device and needs an ADR first. `fieldnote-quj` — the public and private
guardrail rulesets differ, and session 17's compliance map should say so. `fieldnote-aev`
— the throwaway UI, deleted by session 6. `fieldnote-08m` — model-level guardrail behaviour is
unverified until session 7's runner exists. `fieldnote-9gp` — SRI does not cover
client-component chunks. `fieldnote-034` — the eval suite passes against zero cases.
`fieldnote-dx0` — mangled clinical terms reach the model as fact; the classifier's
decision is now recorded in the bead and in the ruleset's version notes, and it stays
open for session 15 and session 9. `fieldnote-xjs` — closed; the layout is validated and the note is the record. `fieldnote-n8z` — three tools have written to governance files and
no automated control was added, with four rejected options recorded. `fieldnote-bdw` —
Safari storage durability across the seven-day eviction window. `fieldnote-ech` — the
denylist matches listed spellings only. `fieldnote-ijg` — nothing is deployed.
`fieldnote-v2s` — the private fork has no session in the guide. `fieldnote-dps` — an
on-device terminology check, considered and not built. `fieldnote-q0h`, roles, is
**closed** by ADR-0007.

**GitHub issues — public record.** One open: **#11**, migrating ESLint to flat config and
upgrading `eslint-config-next` to 16.x, blocked on a migration rather than a version
bump. Dependabot will offer the 16.x bump again at each patch; #27 was closed on those
grounds with the reason on it, and the next one should be too until #11 lands.

**Session prompts — what was asked.** `docs/prompts/`, one file per build-guide session
with the prompt verbatim and a note on how it went. Session 5's file carries the second
version of its prompt, a note on why the first was withdrawn, and a how-it-went section
that names the traps found. Between-session PRs have no prompt file; their instructions
live only in the PR bodies.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`. Records are immutable
once accepted: superseded by a new record when a decision changes, amended in place with
a dated note when a consequence is added. ADR-0007 landed this session and ADR-0006
gained a dated note pointing at it. Three amendments remain owed or worth considering:
ADR-0004 when `fieldnote-bdw` resolves; ADR-0006's five-name evidence statement, which
does not know about the vocabulary failure class; and the substance of the plan §2
conversation, which likely belongs in an ADR rather than a §7 status line.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means. A session brief is a summary
  of it, and summaries drop the constraint that mattered.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong.** Five prompts have now asserted something the repository could not
  support, four of them resting on a prototype nobody can inspect. Session 5's first
  prompt was withdrawn and re-issued after its verification pass, which is the better
  shape: the record then matches what was asked.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself rather
  than letting a green suite imply otherwise. The SRI assertion and the egress check both
  state their limits in place.
- **Verify by running, not by reasoning.** Every hardware, TLS, and bundler finding in this
  repository contradicted something a document said would happen. The standard is to
  demonstrate a control by removing it and watching something fail.
- **Check what is listening before trusting a red or green e2e run.** Playwright reuses an
  existing server on port 3000 outside CI, and a server from the previous day turned the
  whole suite red against a build that predated the branch. `lsof -iTCP:3000` first.
- **The denylist can fire on ordinary vocabulary.** A listed term that is also an English
  word matches wherever that word appears. Remove the word rather than bypass the hook,
  and do not name it in the commit.
- **Check existence and ignore status separately.** `git check-ignore` is a pattern
  query: it reports a match whether or not the file exists.
- **The constraints in `CLAUDE.md` are not optional.** If a task requires violating one,
  stop and say so rather than finding a way around it. The constraint is the point.
- **A finding about the private material is not written into any location the
  repository controls.** The public record says one exists; the substance goes to the
  owner. Beads were assumed private and were publishing on every write, so "internal" is
  a claim to verify by looking at where the data goes, never a tool's description of
  itself.
- **Never `--no-verify`.** If the pre-commit hook fires, stop and show the output. Check
  `git config core.hooksPath` still reads `.husky/_` after any tool that installs hooks of
  its own, including every `bd` command.
- **`gh pr create`, never `--fill`.** `--fill` skips `PULL_REQUEST_TEMPLATE.md`, whose
  checkboxes carry the CLAUDE.md constraints.
- **Stage explicit paths.** Never `git add -A` after a tool has run. An unexpected
  modification to a governance file is a finding, not noise.
- **One session, one PR.** A finding that surfaces mid-session and is not blocking gets a
  bead, not a new branch. Work not attached to a session gets its own small PR.
- **Separate commits per logical change.** Merge with a merge commit rather than a
  squash: the commit history is part of the artifact.

---

## Known gaps in this document

Stated rather than smoothed over.

> **Amended 2026-09-09, containment.** Beads were treated as private and were not. The
> issue tracker that this document, its template, and `CLAUDE.md` all described as
> internal build state was configured by its own `bd init` to push the whole database to
> this repository's public GitHub URL on every write, under `refs/dolt/data`, a ref
> nobody looked for. Four sessions, the owner, and the reviewing instance read "internal"
> as a property of the tool rather than a claim to verify. It was found when a real name
> was about to be written into a bead and the writer checked where beads go first.
>
> **Contained the same day.** The Dolt remote was removed from the embedded repo state,
> the git blobstore cache removed, the backup's git push disabled in `.beads/config.yaml`,
> and the ref deleted from GitHub by the owner. Verified by doing: a bead write after the
> change produced no `refs/dolt/*` on the remote and did not advance
> `.beads/push-state.json`, and a commit through the pre-commit hook, which chains
> `bd hooks run pre-commit`, produced neither either. **The unreachable objects remain on
> GitHub until GitHub's own garbage collection, and no purge was requested.** That is the
> owner's decision, not an oversight, and the reasoning is this: the exposure was one
> term, on a non-branch ref that does not render on GitHub, is not indexed, and is not in
> any clone or fork; finding it required knowing to look for a non-standard ref; nobody
> is known to have fetched it, so nobody holds the object SHAs; and the owner judged the
> residual risk acceptable. Treat what follows as disclosed in that sense.
>
> **What the ref carried, from the local database, by id and category only.** 45 beads,
> created 2026-09-01 to 2026-09-09, with their Dolt history. Searched against the local
> denylist terms, the two private files in 8-word runs not otherwise public, a real first
> name, and price or percentage figures. Findings: `fieldnote-dps` holds the anatomical
> term deliberately kept out of the public documents; `fieldnote-dx0` held the same term
> in its 2026-09-08 note until a 2026-09-09 update replaced that note instead of
> appending to it — the earlier text is in Dolt history, which the ref carried, and the
> owner can restore it locally; `fieldnote-quj` holds the position-and-length record of
> the two words removed from the classifier's lists, which names no word; `fieldnote-bdw`
> holds a non-commercial percentage. No bead holds a denylist term, a real first name, or an
> unsubstituted run of either private file.
>
> **A gap in that inventory, accepted rather than closed.** The search read each bead's
> current state. The ref carried Dolt's commit history, so anything edited or deleted in
> a bead between 2026-09-01 and 2026-09-09 was exposed and was not searched;
> `fieldnote-dx0`'s overwritten 2026-09-08 note is the known instance. The owner judged
> that acceptable on the same reasoning as the purge decision above. **What assumed beads were private and is now
> wrong:** the `CLAUDE.md` agreement of the same morning, replaced; the use of
> `fieldnote-dx0` as a holding place for a held-back term; and this document's own
> description of beads, corrected above. The threat-model entry this owes is in
> `fieldnote-loh`, which is local now.

- **The model's behaviour under the prompt is unverified.** Two live calls were made and
  both behaved; that is a demonstration, not a measurement. Prompt injection inside a note
  delimiter, an attendee's claim adopted as the sender's, and the classifier's
  false-negative rate all wait for session 7's runner. `fieldnote-08m`.
- **The truncation and refusal paths have never fired against the real API.** They are
  tested against a mocked SDK only.
- **Drafts are not persisted and no audit record is written.** Deliberate, per the owner,
  and restored by session 6 — but until then every generation is silent in exactly the
  sense `CLAUDE.md` forbids.
- **The layout validation is one observed session.** `fieldnote-xjs` records it and is
  closed; it is one representative on one day, and the finding is hers, recorded in the
  owner's words without her name.
- **The hardware run is one phone, one day, iOS 26.6.1.** Everything under the runbook's
  *Verified on hardware* is true of that phone. Nothing built in session 5 has been run on
  hardware at all.
- **Storage durability across Safari's eviction window is untested.** `fieldnote-bdw`.
- **Nothing is deployed, and nothing about the deployed path is verified.** `fieldnote-6x5`
  and `fieldnote-ijg`.
- **The private fork has no session and this handoff has no visibility into it.**
  `fieldnote-v2s`.
- **The dictation evidence is two small samples.** Five surnames; one representative, one
  session, two terms. Neither supports a rate.
- **One observed dictation pair is deliberately not in the public documents.** The bead
  names the decision.
- **The service worker update path has no automated coverage.** `fieldnote-unp`.
- **The crash-recovery e2e flaked once this session** — one of three persistence tests
  failed on a full-suite run and passed three times in isolation. Not investigated
  beyond that; `fieldnote-2o9` already records the spec as Chromium-only.
- **One finding about the private material was written into a bead**, `fieldnote-quj`,
  under an agreement that assumed beads were private. They were not; see the amendment
  above. The bead names no word, and the corrected `CLAUDE.md` agreement now sends such
  findings to the owner directly rather than to any location the repository controls.
- **The `Verify` job's cost with the end-to-end suite is measured on two runs**, recorded
  in PR #32; the minute it took before is the comparison. The first run found
  that one headers test had only ever seen a machine with the API key present: on a
  runner the route refuses a malformed body before reading it, by design, and the test
  now accepts both documented statuses.
- **A name with neither a title nor a roster entry is still missed**, and so is a role
  whose head noun is outside the closed list or that is written mid-sentence without a
  determiner. ADR-0006 and ADR-0007 state both.
- **Session-to-PR attribution before session 2 is partly inferred** from commit messages.
- **Hours in the build guide are estimates, not measurements.** Nothing here records
  actual time spent.

---

## How to use this

**Regenerate, do not edit.** Write each handoff by re-reading the sources — `git log`,
the build guide, `CLAUDE.md`, `docs/adr/README.md`, `bd ready`, `bd blocked`, and the
open GitHub issues.

**Point, do not copy.** Anything with a canonical home gets a pointer.

**Every claim traceable.** To a file, a commit, or a command run while writing. If it is
not, say so in *Known gaps* rather than dropping it silently or asserting it anyway.
