# Session 5 kickoff — generation route, guardrails, and headers

Paste everything below the line into a fresh session.

**This is the second version of the prompt.** The first was sent, the session ran its
verification pass, and stopped with four premises that did not match the repository: a
prototype retry-and-truncation fix that had never existed as logic, an undefined term
("accumulated openings"), a fourth conflict between `CLAUDE.md`'s audit-record agreement and
the scope guard, and a done-when that needed a UI nobody had scoped. The owner resolved all
four and re-sent the prompt below, which replaced the first as this session's first commit
so the record matches what was actually asked. The first version is in git history at
`5f84da8`.

---

Session 5 — the generation route, guardrails, and security headers.

You ran a verification pass on this session already and stopped with four premises that
did not match the repository. All four are resolved below by the owner. This prompt
replaces the one at `docs/prompts/session-5.md`; your first commit replaces that file's
prompt section with this text, so the record matches what was asked.

Work from `docs/BUILD-GUIDE.md` session 5, read in full. This prompt is a summary and
the guide is the source of truth — except where this prompt corrects it, which is
marked.

## Gates — both settled, do not re-check as stop conditions

**1a**, the app runs on a phone and holds offline: met. **1b**, an observed session with
the representative on whether the layout is right: **not met, owed, and not blocking
this session** — the owner's decision is in `fieldnote-xjs`. It blocks session 6's
review surface. **Gate 2**, the runbook corrected: met.

## Who is who

Guardian writes these prompts and reviews your work. It has no repository access and
works from `docs/HANDOFF.md`, the beads, and `docs/prompts/`. If something is not written
there, Guardian cannot know it. Five prompts now have asserted something no longer true,
four of them resting on a prototype nobody can inspect. Verify each premise below before
acting on it, and stop if one is wrong.

Read `CLAUDE.md`, `docs/HANDOFF.md`, guide sessions 5–7, plan §4.1 §4.2 §4.3 §4.5 and
§5 non-negotiables 2 and 4, ADR-0005, ADR-0006, and `src/lib/privacy/` in full.

## The four corrections

**1. There is no prototype retry-and-truncation fix to port.** The artifact's drafts came
back cut off because `max_tokens` was set artificially low for the test; the fix was
raising the number. Real, but a config value with no logic in it. Build fresh:

- SDK-handled retries for 429, 5xx, and 529, with the count in one named constant.
- On `stop_reason: "max_tokens"`, retry once at a doubled ceiling. If it truncates again,
  mark the draft truncated and **block it** — a cut-off email reads as finished until you
  reach the end, and it is being copied into a mail client. Same failure shape as the
  mangled clinical terms in `fieldnote-dx0`.
- On `stop_reason: "refusal"`, block the draft; log the category in metadata, never text.
- Pick the initial ceiling from what one follow-up email actually needs and put it in a
  module-level constant beside the model id. Say in your report what you chose and why.

Amend the guide's session 5 entry with a dated note recording that the prototype fix was
a configuration correction, so nobody chases it again.

**2. Accumulated openings, defined by the owner.** One request per attendee carrying that
person's notes; each finished draft's opening line is carried into the next request so a
batch of eight does not open eight identical ways. Token stability across the batch comes
from reusing one pseudonymizer instance.

**3. The audit conflict — a fourth conflict you found, resolved by the owner.** CLAUDE.md
requires an audit record per model interaction; the scope guard defers records to session
6. Resolution: **session 5 generates without audit records, and does not persist drafts.**
Drafts are held in memory. Not persisting is the point — a `DraftRecord` in Dexie with no
`AuditRecord` beside it is the shape the agreement forbids, and session 6 adds both in one
change. Amend the build guide's session 5 and 6 entries with a dated note saying the
agreement is suspended here and session 6 owes it. A PR body is not findable later.

**4. Build the generation UI as a throwaway.** One button in the capture header and a
read-only draft list, following existing component conventions and no further. It is the
pipeline's proof, not the review surface. Open a bead saying session 6 deletes it, and say
so in the PR.

## Roles — policy decided, design yours

Tokenize roles against `AttendeeRecord.role` for this event's attendees. A role matching a
rostered person **shares that person's token**. A role matching nobody gets its own
`[ROLE_n]`, fail-closed on ADR-0006's asymmetry. `bd show fieldnote-q0h` has the reasoning.

Three things the owner has decided since that bead:

**Plural generics are left alone.** "the surgeons", "feedback from the surgeons" refer to
nobody and appear across the corpus. Tokenizing them tells the model a group is a person.
Exclude plurals and generic uses explicitly and record why in the ADR.

**Rehydration is per occurrence, and this is the hard part.** A shared token must come back
as *the form that was written there*: her name where you wrote her name, the role where you
wrote the role. The draft has to read naturally to her. `Pseudonymizer.mapping` is
`token → one string` and cannot express this. Design the fix against the actual module —
do not take a suggestion from this prompt — and demonstrate the round-trip on a note
containing both forms. Every existing test asserts
`rehydrate(pseudonymize(text)) === text`; that invariant must still hold.

**One consequence to state in the ADR rather than discover.** The model receives tokens and
may place them where you would not have. A role token landing where a name reads better
rehydrates faithfully and still reads oddly. That is a review-gate matter (§4.3), not a
boundary failure, and the owner accepts it — but write it down.

Two collisions to resolve and report:

- `Nurse` is already a `WORD_TITLE`, so pass 2 tokenizes the token after it. A role pass
  matching `nurse` interacts with that. Say what you did.
- `tests/unit/pseudonymize.test.ts` has a test asserting roles are *not* tokenized, citing
  `fieldnote-q0h` as a known gap, and `tests/fixtures/dictation.ts` carries a matching note.
  Both invert this session. Do it as a deliberate, commented change, not a quiet edit to
  make a suite pass.

**ADR-0007, not an amendment to ADR-0006.** The index says a changed decision is superseded
and a gained consequence is amended; this widens what the boundary covers and adds a
detection mechanism. Write ADR-0007, add a dated note to ADR-0006's residual-risk section
pointing at it, and update the index.

Build roles before generation is wired to the boundary.

## Adversarial cases

`scripts/evals.mjs` is a placeholder that exits 0 against zero cases, so nothing in this
repository can execute an eval case today. Resolution: **every guardrail you write this
session gets its adversarial case as an ordinary Vitest test under `pnpm test`**, where the
counterfactual is demonstrable now — remove the guardrail, watch the test fail. Session 7
ports them into the corpus and builds the runner. Amend the guide's session 5 and 7 entries
to say so.

Do not build the eval runner or its CI integration.

## The rest of what to build

- **A server-side route handler.** Key stays server-side. Stateless pass-through: validate
  with zod, call the model, return text and stop reason, log metadata never content.
- **Prompt templates and guardrail rulesets as versioned modules.** A change to either
  increments its version; record the versions the audit schema will need in session 6.
- **Claim-bearing text is blocked, all of it.** The library is session 9, so everything
  claim-bearing is unmatched. Drafts come back with gratitude and logistics and a gap. That
  is §4.2 working, not a defect — do not soften the block to a flag or let the model author
  claims.
- **`fieldnote-dx0` — decide it visibly.** How the classifier treats clinical vocabulary in
  relational text. The bead has the analysis and says §4.2 does not answer it by
  construction. Record the decision in the guardrail ruleset's version notes.
- **CSP, SRI, strict headers**, asserted in a test against a live response. If nonces force
  dynamic rendering, confirm the offline shell still holds — the existing e2e suite will
  tell you.
- **Single-egress check in CI.** Grep `src/` for `fetch(`, `XMLHttpRequest`, `new WebSocket`,
  `navigator.sendBeacon`, `EventSource`, remote dynamic imports; the model route is the only
  allowed destination. Baseline today is four `fetch(` calls, all in the service worker, all
  same-origin. This catches the careless case, not the determined one, and must be described
  that way wherever it is cited.

**Model id:** `claude-opus-5`, exactly, no date suffix, in one module-level constant. If the
API rejects it, stop and ask. **The API key:** check it is defined, never read, print, or
echo its value — not in a log, a test, a commit, or your report.

## Scope guard

No audit records, draft state machine, or review gate (session 6). No eval runner (7). No
roster import (8). No approved content library (9). No encryption (19). No schema change —
stop and say so if the route seems to need one. No Dexie outside `src/lib/db/`. No second
network destination. Do not rename a CI job: branch protection requires `Verify`,
`Adversarial guardrail suite`, and `Analyze (javascript-typescript)` by display name.

## Constraints

TypeScript strict, no `any` without an adjacent comment. Never `--no-verify` — if the hook
fires, stop and show the output. Check `git config core.hooksPath` reads `.husky/_` before
your first commit and after every `bd` command. `gh pr create` without `--fill`. Stage
explicit paths, never `git add -A`. Separate commits per logical change. Merge commit, not
squash. One session, one PR; non-blocking findings get beads. Prefer the plainly correct
implementation and say so if a task tempts you toward a shortcut. `pnpm evals` costs real
API spend — run it deliberately.

Last commit regenerates `docs/HANDOFF.md` from `docs/HANDOFF-TEMPLATE.md` by re-reading
sources. While you are there: the current handoff's denylist caveat has a dangling
fragment — a sentence beginning "Human review of those diffs is the control" ending with
`fieldnote-ech` as an orphan. Find where that text originates so the regeneration does not
reproduce it.

## Stop conditions

Stop and report rather than deciding, if: the roles design needs a decision not made above;
anything requires a schema change, a new dependency, or a second network destination; the
pre-commit hook fires; `core.hooksPath` is not `.husky/_`; or a premise here turns out not
to match the repository.

## Done when

Drafts generate end to end with names and roles tokenized in the API payload and correct in
the UI, with a shared role token rehydrating per occurrence. Claim-bearing output blocked
with the gap visible. Every guardrail has a test that fails when the guardrail is weakened —
demonstrated, not claimed. Headers asserted against a real response. The egress check goes
red when a second destination is added, verified by adding one temporarily. `pnpm test`,
`typecheck`, `lint`, `build` green.

## Report back

(1) Verified versus assumed, with the command for each. (2) The roles design — unmatched-role
detection, the per-occurrence rehydration mechanism, the `Nurse` collision, and the
counterfactual — before building past it. (3) The truncation ceiling you chose and why.
(4) What you built, file by file. (5) Where you were tempted toward a shortcut and what you
did instead. (6) Beads created or closed, and the amendments made to the guide and the ADRs.
(7) Flags last, including anything in the plan, guide, handoff, or this prompt that turned
out to be wrong.
