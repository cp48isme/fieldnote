# Session 5 kickoff — generation route, guardrails, and headers

Paste everything below the line into a fresh session.

**Two gates must be cleared before this session starts.** They are at the top of the prompt
and they are stop conditions, not warnings.

---

Session 5 — the generation route, guardrails, and security headers. Work from
`docs/BUILD-GUIDE.md` session 5; read it in full before writing anything. This prompt is a
summary and the guide is the source of truth.

## Before this session starts — two gates

**Do not begin work until both are satisfied. If either is not, stop and say so.**

1. **The capture surface has been used on a physical device**, and `fieldnote-xjs` has been
   updated with what happened.

   > **Amended 2026-09-08, by the owner, after the first hardware run.** This gate was one
   > sentence and hardware answered half of it, so it is now two.
   >
   > **1a — answered.** The app runs on a phone, installs standalone, and holds offline
   > after a full kill; the representative dictated into it and corrected text against a
   > real keyboard. iOS 26.6.1. `docs/TESTING-ON-DEVICE.md` under *Verified on hardware*
   > is the record. **Met.**
   >
   > **1b — still owed.** An observed session with the representative: whether the layout
   > is right for her, where she hesitates, what she reaches for that is not there.
   > `fieldnote-xjs`'s own words are that her reaction is the validation that was
   > deferred, and that has not happened. Dictating into the surface tested the input
   > path, not the design. **Not met**, and the owner's reading is that it is not.
   >
   > **1b does not block session 5 specifically.** The gate exists to stop work building on
   > a layout nobody has evaluated. The layout decisions are shallow by design — where the
   > dock sits, what a log row shows — and generation does not depend on any of them: the
   > route, the guardrails, and the headers touch nothing the representative's reaction
   > could change. **It becomes a blocker before anything builds on top of the layout** —
   > the review surface in session 6 is the first candidate — and whichever session that
   > is must check `fieldnote-xjs` rather than this note.
   >
   > The paragraph this replaces said everything about phone behaviour had been reached
   > headlessly. That is no longer true and it is kept only as history: the `dvh` column,
   > the dock above the software keyboard, and iOS zoom on focus have now been met on
   > hardware; hit targets under a thumb have not been assessed.

2. **`docs/TESTING-ON-DEVICE.md` has been corrected with what actually happened on
   hardware.** The iOS certificate trust steps in it are the documented flow, not a
   transcript, and the document says so. It also flags one thing that decides whether the
   rest applies: whether a self-signed *leaf* certificate can be trusted through iOS's
   Certificate Trust Settings, or whether a small CA is needed instead.

   > **Answered 2026-09-08.** A leaf cannot be trusted on iOS; a CA is needed, and
   > `scripts/serve-https.mjs` now generates one. The document was corrected in #28 and
   > #29 and has a *Verified on hardware* section. **Met.**

Check both against the repository rather than assuming. `bd show fieldnote-xjs`, and read
the document's "Still unverified" section.

## Who is who

Prompts like this one are written by **Guardian**, a separate Claude instance that reviews
your work and drafts the prompts. It runs with no shared context with you and no direct
view of the repository — it works from the committed artifacts. I send them, I arbitrate
between you when you disagree, and I decide anything either of you flags.

That has one practical consequence worth holding onto: **`docs/HANDOFF.md`, the beads, and
this directory are the only channel between you and Guardian.** If something is not written
there, Guardian cannot know it, and the next prompt will be built without it. It also means
the premises in this prompt are drawn from documents that may have drifted from the
repository. Four times now a prompt has asserted something that was no longer true — the
validated prototype that had not been retrieved, the shadcn line, an assumption about a TLS
certificate, and a check proposed on an unverified guess about what a tool had written.

So: **verify each premise below against the repository before acting on it.** If something
is already resolved, already documented, or stated wrongly here, do not build around it —
stop and tell me. That is not pedantry, it is the single habit that has paid off most.

## Read first, in full, in this order

1. `CLAUDE.md` — the non-negotiable constraints. Several bear directly on this session.
2. `docs/HANDOFF.md` — start here for state; it carries what the last day surfaced and what
   is still owed.
3. `docs/BUILD-GUIDE.md` — session 5 in full, and sessions 6 and 7 well enough to know what
   is not yours.
4. `docs/PROJECT-PLAN.md` — §4.1 (pseudonymization and the single-egress claim), §4.2
   (claim-bearing text), §4.3 (the review gate), §4.5 (the eval suite), §5 non-negotiables
   2 and 4.
5. `docs/adr/0006-structural-name-detection.md` — what the boundary you are about to cross
   actually guarantees, and what it does not.
6. `docs/adr/0005-dictation-input.md` — why there is exactly one egress, and why a second
   would falsify §4.1 rather than weaken it.
7. `src/lib/privacy/pseudonymize.ts` and `titles.ts` — read the code, not the summary.
8. `docs/prompts/session-4.md` — what was asked last session and how it went. The
   "how it actually went" sections are where the prompts' own mistakes are recorded.

## Verification pass — report before writing code

- **Clean start.** Working tree clean, no open PRs, branched from current `main` — say
  which commit.
- **`git config core.hooksPath` reads `.husky/_`.** Check before your first commit and
  again after every `bd` command. An installer has silently repointed it once already.
- **Do not rename any CI job.** Branch protection requires `Verify`, `Adversarial guardrail
  suite`, and `Analyze (javascript-typescript)` by display name. A rename drops the
  requirement silently.
- **The privacy boundary's real API.** Read `src/lib/privacy/` and confirm what the route
  needs — `createPseudonymizer`, `assertPseudonymized`, and what the mapping actually
  holds. Do not infer it from ADR-0006's prose.
- **The API key.** `ANTHROPIC_API_KEY` is in `.env.local` and as a repository secret. Do
  not read, print, or echo its value anywhere — not in a log line, a test, a commit, or
  your report. Checking that it is *defined* is different and is expected: a boolean test
  on `process.env.ANTHROPIC_API_KEY` at route start-up, and a startup failure that names
  the variable and nothing else, are both fine. The distinction is between the name and
  the value.
- **Model identifier.** Use `claude-opus-5`, exactly that string, no date suffix. Do not
  write a model id from memory and do not substitute: if the API rejects that id, stop and
  ask rather than trying another. Record the id where the audit schema's `model` field
  will need it, and put it in one module-level constant so changing it later is one line.

## What to build

Per the build guide, ~3.5 hours:

- A **server-side route handler** for generation. The key stays server-side; the client
  never holds it.
- **Prompt templates and guardrail rulesets as versioned modules.** CLAUDE.md requires that
  a change to either increments its version and is recorded in the audit schema.
- **An adversarial case for every guardrail you write** — see *Two resolved conflicts*
  below.
- **Per-person batching with accumulated openings**, and the retry and truncation handling
  from the prototype fix.
- **CSP, SRI, and strict security headers** (plan §5 non-negotiable 4), about 45 minutes.
  Assert them in a test against a live response, not in a config nobody reads again.
- **A single-egress check in CI** (plan §4.1, ADR-0005), about 30 minutes. A grep over
  `src/` for `fetch(`, `XMLHttpRequest`, `new WebSocket`, `navigator.sendBeacon`,
  `EventSource`, and remote dynamic imports, with the model route as the only allowed
  destination. The guide is explicit that this catches the careless case rather than the
  determined one, and that it must be described that way wherever it is cited.

## Three resolved conflicts — build to these, do not re-litigate them

The first two were found while writing this prompt. The third was decided by the owner
afterwards, on 2026-09-08, so that this session opens with work rather than a stop.

**1. Eval ordering.** CLAUDE.md says "write the eval case before the guardrail; a guardrail
with no adversarial test is unverified." The build guide puts guardrails here and the eval
suite in session 7. Those cannot both be satisfied as written.

*Resolution: CLAUDE.md wins on principle, the guide wins on sequencing.* **Session 5 writes
the adversarial cases alongside each guardrail it builds, so nothing ships unverified.**
Session 7 builds the runner and the CI integration that execute them at scale, and adds the
rest of the corpus. The build guide's session 5 and 7 entries have been amended to say so.

**2. Claim-bearing text with no library to select from.** CLAUDE.md is absolute that
claim-bearing text is selected from the approved content library and never authored, and
that unmatched claim-bearing output is blocked rather than flagged. The library is session 9
and does not exist yet.

*Resolution:* with no library, **everything claim-bearing is unmatched, so session 5 blocks
all of it.** Drafts come back with gratitude and logistics and a gap where product language
would go. **That is correct behaviour, not a defect** — it is exactly what §4.2 describes,
observed early. Do not resolve it by letting the model author claims until session 9 exists,
and do not soften the block to a flag. If the gap looks wrong in a draft, that is the
control working.

**3. Roles.** `fieldnote-q0h`: the tokenizer does not see role references, and in a
single-institution note "the Biomed Director" identifies a person as surely as a surname. A
role reaching the model is the same failure as a name reaching it, and this session wires
generation to the boundary, so it had to be decided first.

*Resolution, decided by the owner:* **tokenize roles, matched against `AttendeeRecord.role`
for the attendees at this event.** Where the role matches a rostered person, the role
**shares that person's token** — "Dr. Okafor" and "the Biomed Director" are one `[HCP_1]`,
because two mentions being one person is information the draft needs. A role that matches
nobody on the roster **gets its own token** (`[ROLE_1]`), fail-closed, on the same
asymmetry ADR-0006 already records: an over-tokenized noun costs an odd sentence, a role
that passes through sends identity. What is *not* decided, and is yours to design and
record in the ADR-0006 amendment this implies: how an unmatched role-shaped phrase is
recognised at all, since roles are an open set — the bead's suggestion is a determiner
followed by a role-shaped phrase, and it names why that is harder than the title rule.

## What session 4 handed you

- Everything crossing to the model goes through `createPseudonymizer` and then
  `assertPseudonymized`.
- **Token stability across a batch comes from reusing one pseudonymizer instance.** That is
  what per-person batching with accumulated openings needs; a fresh instance per note
  restarts the numbering.
- **ADR-0006 assigns you one thing explicitly:** `assertPseudonymized` throwing is an
  internal invariant, not user-facing validation. If it fires, the tokenizer has a defect.
  You own making that surface as a defect report to the developer rather than as a failure
  to the representative. A tool that refuses to draft in a car park is one she stops using.

## Roles — decided, see resolved conflict 3

`bd show fieldnote-q0h` has the design shape and the decision. Four of the seven notes in
the corpus name nobody any other way, so this is not an edge case. Build it before
generation is wired to the boundary, not after.

## Scope guard — do not build any of this

- **No audit records, no draft state machine, no review gate.** Session 6. You will write
  the *versions* the audit schema needs; you do not write the records.
- **No eval runner and no CI integration for it.** Session 7. You write cases; session 7
  builds the thing that runs them at scale.
- **No roster import.** Session 8. **No approved content library.** Session 9.
- **No encryption implementation.** Hooks stay identity pass-throughs. Session 19.
- **No schema change.** If the route seems to need a field, stop and tell me.
- **No Dexie import outside `src/lib/db/`.**
- **No second network destination.** The check you are building is the thing that proves
  §4.1; do not weaken it to accommodate something you added.

## Constraints

TypeScript strict, no `any` without an adjacent comment. Never `--no-verify` — if the hook
fires, stop and show me. `gh pr create` without `--fill`. Separate commits per logical
change. Merge commit, not squash. One session, one PR; a non-blocking finding gets a bead.
Stage explicit paths — never `git add -A` after a build tool has run, per the working
agreement in CLAUDE.md. Prefer the plainly correct implementation, and say so if a task
tempts you toward a shortcut rather than taking it. The last commit regenerates
`docs/HANDOFF.md` from `docs/HANDOFF-TEMPLATE.md` by re-reading the sources.

`pnpm evals` costs real API spend. Run it deliberately, not on every save.

## Stop conditions

Stop and report rather than deciding, if: **gate 1a or gate 2 is unmet** (1b is owed, not
blocking — see the amendment above); the roles implementation needs a decision resolved
conflict 3 does not make; anything requires a schema change, a new dependency, or a second
network destination; the pre-commit hook fires; `core.hooksPath` is not `.husky/_`; or a
premise in this prompt turns out not to match the repository.

## Done when

Drafts generate end to end with names tokenized in the API payload and correct in the UI.
Claim-bearing output is blocked, with the gap visible in the draft. Every guardrail written
this session has an adversarial case that fails when the guardrail is weakened. A test
asserts the security headers against a real response. The single-egress check fails when a
second destination is introduced — **verified by adding one temporarily and watching the
build go red**, not asserted. `pnpm test`, `typecheck`, `lint`, and `build` green.

Demonstrate the counterfactuals rather than claiming them. That is the house standard: every
control this project has shipped was proved by removing it and watching something fail.

## Report back

(1) Verified versus assumed, with the command or file for each, including both pre-session
gates. (2) How the roles decision was implemented — the unmatched-role detection you
designed, and its counterfactual — before you build past it. (3) What you built, file by file. (4) Where you were tempted toward a shortcut and
what you did instead. (5) Beads created or closed. (6) Flags last — including anything in
the plan, the guide, the handoff, or this prompt that turned out to be wrong.
