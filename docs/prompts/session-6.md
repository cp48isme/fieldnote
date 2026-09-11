# Session 6 — Audit log and review gate

Verified against the repository on 2026-09-11 at `9c4eda7` on `docs/between-sessions-5-and-6`,
before being sent. Corrections to the owner's draft are marked **[corrected]**; additions
found by checking are marked **[added]**. The how-it-went section is written after the
session runs.

---

Session 6 — the audit log and the review gate. On `main` after PR #33 and the `next`
security bump (#35, see *Before branching*) merge.

Work from `docs/BUILD-GUIDE.md` session 6, read in full including both dated amendments.
This prompt is a summary and the guide is the source of truth, except where this prompt
corrects it, which is marked.

Read before starting: `CLAUDE.md`; `docs/HANDOFF.md`; guide sessions 6 and 7; plan §4.1,
§4.2, §4.3, §4.4, §4.6; ADR-0004 (the encryption seam) and ADR-0007; `src/lib/db/` in
full; `src/lib/generation/pipeline.ts`. And `bd show fieldnote-g7d` before you design any
UI — the representative's own feature request, so the review surface is designed knowing
where the product is going.

## Before branching **[added]**

GitHub reports five Dependabot alerts on `main` dated 2026-09-09: four critical on `next`
below 16.3.3 and one high on `sharp` below 0.35.4. Dependabot's #35 bumps `next` to 16.3.4,
which carries the fixed `sharp`, and its `Verify` job fails on
`tests/e2e/headers.spec.ts`: 16.3.4 emits client chunks with a `nonce` attribute and without
`crossorigin`, and the spec's pattern for an uncovered same-origin chunk expects the old
shape. That is a spec update and a framework bump, not session work. Land it first, as its
own small PR against #35 or on top of it, so that a framework change does not arrive
mid-session under strict up-to-date branch protection. While there, check whether the nonce
on chunks changes what `fieldnote-9gp` (partial SRI) records, and note it on the bead.

## Corrections to the guide **[corrected]**

**Gate 1b is met, and the guide already says so.** PR #33 added a dated amendment under
session 6 (commit `369e356`) recording that the gate closed on 2026-09-09, pointing the review
surface at `fieldnote-g7d`, and folding `fieldnote-x9p` into this session. Verify the note
is there; there is nothing further to amend on this point.

**"The versions are ready" is true for what it names and silent on the rest.** `model`,
`promptTemplateVersion`, `guardrailRulesetVersion`, and `flagsFired` all exist on
`AuditRecordRecord` and all come out of `DraftOutcome`. What the amendment does not say is
that `inputHash`, `outputHash`, `editDistance`, and `humanEdited` have no producer, and that
`DraftRecord` carries neither flags nor a blocked reason. Add that in this session's own
dated note, beside the schema change.

The bead the amendment declines to name is `fieldnote-aev`.

## What lands, in one change

Draft persistence and the audit record together. Session 5 held drafts in memory
precisely so no `DraftRecord` could exist without an `AuditRecord` beside it, and that
suspension is recorded in the guide. This session restores `CLAUDE.md`'s
no-silent-generations agreement by adding both at once. A draft that persists without its
record is the failure this session exists to prevent — assert it, don't just intend it.

## The schema

`DraftRecord` and `AuditRecordRecord` have existed since session 2 with field policies and
Dexie stores (`src/lib/db/schema.ts`, `migrations.ts` v1). What is missing is narrower than
the guide implies, and slightly wider than the owner's draft of this prompt assumed.

**Two fields the owner has decided to add to `DraftRecord`:**

- `flagsFired` — the rule ids that fired on this draft. It is also on the audit record,
  and that duplication is deliberate: the review surface must be able to tell the
  representative why a sentence was replaced without reading the audit trail, because a
  UI that depends on the audit log inverts the relationship between them.
- `blocked` — the `BlockReason`, or null. See the next section.

**A third the evidence says is needed — owner to confirm. [added]** `DraftRecord` has one
`body`, the review surface edits it, and edit distance is computed between the generated
text and the exported text. An audit record holds hashes, not content, so the generated text
must survive on the draft for the distance to be computable at export. The recommendation is
a `generatedBody` field, encryption-eligible for the same reason as `body`, written once at
creation and never updated; `body` stays the editable one. The alternative — computing and
storing the distance on every edit — makes the number depend on edit history rather than on
what was exported. If the owner prefers a different shape, stop and say so before the
migration is written.

`recipientToken` is not persisted. `attendeeId` identifies the recipient; the token is a
boundary artifact with no life after rehydration. `explanation` need not be persisted
either: it is derived from `BlockReason` through `BLOCK_EXPLANATIONS` in the pipeline, so
persist the reason and derive the text. **[added]**

**Two hashes to compute**, `inputHash` and `outputHash`. Nothing computes them today.
They are the point of an audit record that holds no content — decide what is hashed
(pseudonymized input? rehydrated output?), say why in the ADR or a module comment, and be
consistent. Hash the pseudonymized form, not the rehydrated one, unless you can argue
otherwise: an audit record whose hash only reconstructs against text containing real names
is a worse record.

**Where the pre-images are. [added]** `DraftOutcome` exposes neither. The pipeline holds
the pseudonymized notes where it builds the request (`pipeline.ts` around line 170), the
model's raw text at the `requestDraft` call, and the guarded text after `applyGuardrails`.
Compute the hashes inside `generateDrafts` and put `inputHash` and `outputHash` on
`DraftOutcome`, so the pre-images never leave the pipeline; do not widen `DraftOutcome` to
carry pseudonymized text out to the caller.

Both are schema changes. `CLAUDE.md` requires a migration and a version bump, and the
field-policy entries carry their reasoning like every other field — `FieldPolicies<T>` is
a mapped type over `Required<T>`, so an unclassified field is a type error.
`CURRENT_SCHEMA_VERSION` goes to 2, and `MIGRATIONS` gains a v2 entry with the full store
declaration.

## Blocked drafts persist, and can never be exported

The owner's decision. A blocked draft has an empty body and a reason. Discarding it is
simpler and wrong: a refusal or a withheld hallucination is the most audit-worthy thing
the pipeline does, and if the draft is discarded the audit record has nothing to point at
and "every generation writes a record" is false for exactly the generations that matter.

So a blocked draft is persisted with its `blocked` reason and its audit record. It is
outside the export path by construction, not by a check that could be removed. Design that
yourself — a fourth state, a guard on the transition, whatever the type system can enforce
best — and demonstrate that a blocked draft cannot reach `exported` by any route, including
one added carelessly later.

## The review gate

Plan §4.3: `generated` → `reviewed` → `exported`. Export disabled until a human has
opened the draft. No automated sending, copy-to-clipboard only. `DraftState` in
`schema.ts` already declares the three states; nothing enforces the transitions.

Two things to get right rather than approximate. **What counts as "opened"** — rendering
a list row is not review; the transition needs an act. Say what you chose and why.
**Export is impossible from `generated`**, demonstrated: remove the guard and watch a test
fail.

## Over-blocking is the risk this session can measure

The owner's constraint, and it should shape what you build: guardrails that fire too often
make the product useless. Today every draft comes back with gaps, because claim-bearing
text is blocked unconditionally until session 9's approved content library exists. That is
expected and is not the problem.

The problem is that nothing measures how often a guardrail blanks a sentence that was
fine. Session 7's runner measures false negatives — whether the model produces violations.
False positives have no instrument at all, and `flagsFired` plus `editDistance` are the
only candidates.

So build them as a measurement rather than a decoration: the flags stored per draft, the
edit distance stored per draft, and both readable together across an event. The CSV export
should carry them for the same reason. Do not build a scoring system or a threshold — the
data has to exist before anyone can reason about the rate. Open a bead recording that the
false-positive rate is unmeasured, that this session provides the instrument, and that
session 9's library is what will actually reduce the blocking. No such bead exists
(`bd search` on "false positive", "over-block", "edit distance", "dashboard" all empty on
2026-09-11). **[added]**

## The review surface

Delete `src/components/capture/DraftList.tsx` and the "Draft follow-ups" button in
`CaptureScreen` (line 347, and the `DraftList` render at 376), and replace them with the
review surface. Closes `fieldnote-aev`.

It reads every draft, shows why a sentence was replaced where one was, allows editing,
carries the state transitions, and copies to the clipboard. It is on the capture layout,
which is validated. `fieldnote-g7d` tells you where the product is going; do not build the
briefing package, but do not design something the pre-meeting path would have to be
demolished to add.

## Edit distance

The guide calls it the quiet centerpiece and asks for a dashboard. The owner's decision:
**capture the number and show it plainly this session; the dashboard is deferred.** It is
computed between the generated text and the exported text, stored on the audit record with
`humanEdited`, and visible somewhere honest — on the draft, or as a figure on the review
surface. Open a bead for the dashboard with what it would need.

State plainly, wherever it is surfaced, what the number does and does not mean. A low
distance may mean a careful reviewer agreed with a good draft. It is a signal, not a
measurement of diligence, and a document that implies otherwise is the kind of overclaim
this repository exists to avoid.

## ADR: audit records survive event deletion

`fieldnote-x9p`, open since session 2 **[corrected]** — created 2026-09-01, the day PR #12
merged — documented only in a source comment and PR #12's body. `deleteEvent` in
`src/lib/db/repository.ts` cascades to attendees, notes, and drafts inside one transaction
and deliberately spares audit records, so a user cannot truncate their own audit trail;
records are orphaned by design and readers must tolerate an `eventId` pointing at nothing.

This session writes the first audit records, so it writes the ADR, number 0008. Include the
consequence that a blocked draft's record also survives, and what an orphaned record means
for the CSV export. Closes `fieldnote-x9p`.

## CSV export

Plan §4.4 maps the audit log to EU AI Act Article 12. Export the records for an auditor:
what happened, when, under which model and versions, which rules fired, whether a human
edited it and by how much. Orphaned records are included — say so in a column or a header,
because an auditor reading a record whose event is gone should not think the file is
corrupt.

## Adversarial cases

Every guardrail or invariant this session adds gets a case that fails when the thing is
weakened, as ordinary Vitest tests under `pnpm test` in `tests/unit/`. Session 7 ports them
and builds the runner; do not build the runner or its CI integration here.

At minimum: export blocked from `generated`; a blocked draft unable to reach `exported`;
a draft persisted without its audit record failing; the audit record surviving event
deletion. None of these exists today — no unit or e2e test references `deleteEvent`,
`auditRecords`, or `DraftState`. **[added]**

## Scope guard

No eval runner or corpus (7). No roster import (8). No approved content library (9) — the
gap marker stays and claim-bearing text stays blocked. No encryption (19); the seam stays
identity. No second network destination. No new dependency without saying why and stopping
first — an edit-distance implementation is a few dozen lines, not a package. Do not rename
a CI job: branch protection requires `Verify`, `Adversarial guardrail suite`, and
`Analyze (javascript-typescript)` by display name.

## Constraints

TypeScript strict, no `any` without an adjacent comment. Never `--no-verify` — if the hook
fires, stop and show the output. Check `git config core.hooksPath` reads `.husky/_` before
your first commit and after every `bd` command. Beads are local since 2026-09-09, verified
again on 2026-09-11 (`git-push: false` in `.beads/config.yaml`, `push-state.json` unchanged
since containment); nothing private goes in one regardless. Stage explicit paths, never
`git add -A`. Separate commits per logical change. `gh pr create` without `--fill`. Merge
commit, not squash. One session, one PR; non-blocking findings get beads. `pnpm evals`
costs real API spend.

**Regenerate the handoff from `docs/HANDOFF-TEMPLATE.md` by re-reading the sources.** The
last two commits titled "regenerate" changed 52+/34− and 48+/12− lines of a 516-line file
**[corrected: the evidence]** — that is editing in place whatever the message says, and
`CLAUDE.md` warns a handoff written from the last handoff drifts. Say in your report what
changed structurally as a result. The template's guidance on beads changed in #33; read it.
The bead-count line is not a stray "42" but a wrong one: it reads "42 issues: 30 open, 11
closed, 4 deferred", which does not add up, and `bd stats` on 2026-09-11 says 45 total, 29
open, 12 closed, 4 deferred, 17 ready, 12 blocked. Regenerating from `bd stats` fixes it.

## Stop conditions

Stop and report rather than deciding, if: the blocked-draft design or the `generatedBody`
question needs a decision not made above; anything needs a second network destination or a
new dependency; the pre-commit hook fires; `core.hooksPath` is not `.husky/_`; or a premise
here turns out not to match the repository. Five prompts running have carried a stale
premise, and this one carried three before it was checked. Assume it still does and check
before building on it.

## Done when

Every generation writes an audit record, and no draft exists without one — demonstrated,
not asserted. Export is impossible from `generated`. A blocked draft persists, carries its
reason, and cannot reach `exported` by any route. Edit distance is captured and visible.
The audit log exports to CSV including orphaned records. The throwaway UI is gone. Every
guardrail added has a test that fails when it is weakened. `pnpm test`, `typecheck`,
`lint`, `build`, and the e2e suite green.

## Report back

(1) Verified versus assumed, with the command for each. (2) The blocked-draft design and
the export guard, with the counterfactual, before building past it. (3) What you hash and
why. (4) What counts as "opened" for the review transition. (5) What you built, file by
file. (6) Where you were tempted toward a shortcut and what you did instead. (7) Beads
created or closed; the ADR; the guide amendments. (8) Flags last, including anything in
the plan, guide, handoff, or this prompt that turned out to be wrong.

---

## How it actually went, for whoever reuses this

**The verification pass was done before the prompt was sent, and it still found things
during the session.** The prompt above had already been checked against the repository
and carried three corrections; none of those needed re-correcting. What the session found
that the check had not:

- **`toContainText` does not read a textarea's value.** The first end-to-end run failed
  on an assertion that looked right. `toHaveValue` is the one. Twenty minutes, not a
  finding about the product.
- **The greeting rehydrates without the title.** ADR-0007 says a draft is rehydrated
  with canonical forms — a rostered name with titles removed — and the spec had assumed
  "Dear Dr. Okonjo-Baptiste,". It is "Dear Okonjo-Baptiste,". Plan §4.1 says the
  greeting is templated from the name field, which is not built; the model writes it.
  Not wrong, and the review gate exists for it, but a reader of the draft will notice.
  Worth a line in session 9 or 10.
- **`git rm` stages.** The throwaway's deletion was staged by `git rm` before a `git add`
  of two other files, and rode into the wrong commit. Caught on `git status` before push;
  the commit was undone and redone. The working agreement about staging explicit paths
  is about `git add`; `git rm` has the same shape.

**Decisions made in the session rather than read:**

- **`generatedBody` was added**, as the prompt recommended, and no owner decision was
  needed because the alternative — computing distance on every edit — makes the number
  depend on edit history rather than on what was exported. Stated in the schema.
- **`explanation` is not persisted.** Derived from the reason through a function the
  pipeline now exports.
- **"Opened" is tapping into the detail view.** The list is buttons; a row rendering is
  not review; the detail view is the only place that can export. `markReviewed` is called
  from exactly one handler.
- **After export the body is read-only and can be copied again without a new record.**
  A second copy of the same text is not a second export.
- **The CSV holds no event name.** Event names are encryption-eligible (they identify a
  site) and the log is ids and hashes only. `eventStatus` is the orphan column.
- **The tests use an in-memory fake of the Dexie surface**, not `fake-indexeddb`, for the
  reason `session-lifecycle.test.ts` already gave. The tempting shortcut was the
  dependency; the storage path is covered by the end-to-end spec in a real browser.
- **A `next` security bump landed first**, as its own PR (#36), because the prompt's
  ordering said so and because the Dependabot PR's own run had failed on the headers
  spec. Playwright 1.63 in the same group needed a new Chromium binary locally.

**What the handoff regeneration changed structurally** is stated in the handoff itself,
under *Known gaps*.
