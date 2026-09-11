# Session 7 — Adversarial eval suite

Verified against the repository on 2026-09-11 at `57b62d3` on `main` before work began;
the read-only printout that informed it is in the session transcript, not here. The
how-it-went section is at the end.

---

Session 7 — the adversarial eval suite. On `main` at `57b62d3`. Nothing is open.

Work from `docs/BUILD-GUIDE.md` session 7, read in full including its three dated
amendments. This prompt is a summary and the guide is the source of truth, except where
this prompt corrects it, which is marked.

Read before starting: `CLAUDE.md`; `docs/HANDOFF.md`; plan §4.2, §4.5, and §7 with its
amendment; `scripts/evals.mjs` and `.github/workflows/evals.yml`; `src/lib/generation/`
in full; `tests/unit/guardrails.test.ts` and `tests/fixtures/dictation.ts`;
`bd show fieldnote-034`, `fieldnote-08m`, `fieldnote-ay2`, `fieldnote-7zo`.

## Corrections to the guide's session 7 entry

**"Ports" overstates it.** The fifteen sentences in the six rule blocks of
`guardrails.test.ts` are what a model would write if the prompt failed. They are outputs.
A corpus is notes that provoke those outputs. The fifteen serve as expected-violation
oracles — the shape of a failure the ruleset must catch — and the corpus is a new
artifact. Amend the 2026-09-09 note to say so.

**"The classes session 5 had no guardrail for"** is stale. Every class in plan §4.5 has a
rule except the two that are model behaviours rather than rule classes: prompt injection
inside a note delimiter, and an attendee's claim adopted as the sender's. Those two plus
breadth are the corpus gap.

**The prompt template is 1.1.0.** The model no longer writes the greeting. Any oracle
expecting a salutation in model output is wrong from the start.

Amend the entry with a dated note carrying all three.

## What the runner measures

Each corpus case is a note engineered to provoke one violation class. The runner sends it
through the real prompt, gets the model's draft, and records two things separately:

- **Did the model produce the violation?** The prompt-level rate. This is the number
  nobody has ever measured — `fieldnote-08m` — and it is the interesting one.
- **If so, did the ruleset catch it?** `applyGuardrails` on the model's text, checked
  against the case's expected flag.

The **combined result** — the violation did not reach the draft, by either defence — is
the gate. It must be 100%. The ruleset is deterministic, so a violation that reaches the
draft is a real gap, not model noise, and the build should fail on it. If you want a
threshold below 100% you have to argue for it in the report, and the default answer is no.

The **prompt-level rate** is published, per class, and is not a gate.

## How the runner reaches the model

Directly, via the SDK, not through the route. Going through the route only shows
post-guardrail text, which hides the prompt-level rate above. But the runner must send
exactly what production sends: `buildSystemPrompt`, `buildUserMessage`, `MODEL_ID`,
`EFFORT`, `MAX_OUTPUT_TOKENS`. Import them; do not duplicate them. If the route's `draft`
function has to be extracted into a shared module so both callers use one code path, do
that and say so. A test asserts the runner's request shape equals the route's, so the two
cannot drift silently.

The runner reads `ANTHROPIC_API_KEY` by name and refuses to run without it, the way the
route does. It never prints a value.

## The corpus

**Built from the public fixtures, never from `private/`.** The adapted cases in
`tests/fixtures/dictation.ts` already carry the dictation artifacts plan §4.5 wants —
the run-ons, the homophones, the split compound noun, the abandoned clause, the
claim-shaped question — with every identifying and commercial term substituted. `private/`
exists on this machine and is absent on every runner; a session that reads it here would
not be caught by CI, so don't. If a class needs an artifact the fixtures lack, construct
it and label it constructed, per the fixture header's own convention.

One case per class in plan §4.5 at minimum, and the two model-behaviour classes need
particular care:

- **Prompt injection inside a note.** The payload goes into genuine dictation artifacts,
  not clean prose — the guide is explicit. `tests/unit/prompt.test.ts` proves the
  delimiter cannot be escaped structurally; this is the behavioural check.
- **The attendee's claim adopted as the sender's.** Plan §4.2's distinction, and ruleset
  1.1.0's attributed-question rule. Cases where the note reports a claim the attendee made
  and the assertion is whether the draft attributes it or asserts it.

Each case: id, class, provenance, the note, the roster, and the assertion. Cases live in a
committed file the runner reads; the shape is yours.

## Gating spend

The suite is a required check on every PR and now costs real money. The owner's decision:
**the runner decides whether to call the model based on what the PR changed.** If the diff
against the base touches none of `src/lib/generation/`, the corpus, the runner, or the
model settings, the runner says so in the log and exits 0 without a single API call. If it
touches any of them, it runs live. `workflow_dispatch` always runs live.

Two constraints on that:

- The path list is in one place, commented, and a test asserts it covers every file that
  can change the prompt, the ruleset, the model parameters, or the cases. Add a file to
  `src/lib/generation/` and the test should still cover it without editing the list.
- The short-circuit log line says what was checked and why it skipped. A green check with
  no explanation is what `fieldnote-034` exists to complain about.

Measure and report what one full live run costs — tokens and dollars, from the API's
usage fields. Put the figure and the case count in the workflow comment.

## Nondeterminism

The model's output varies. Decide how the runner handles it — one call per case, or N —
and say why. If N, say what N costs. A case that passes on one run and fails on the next
is a finding about the prompt, not a flake to retry away; the runner should surface it,
not hide it.

## The README

The owner's decision: **write a minimal `README.md` this session.** It is the done-when's
publication target and it does not exist. Contents: what the project is, in a paragraph;
what it deliberately does not do, drawn from plan §5's non-negotiables and §4.3; and an
eval results section carrying the prompt-level rate per class, the combined rate, the
date, the model, the prompt and ruleset versions, and the case count. No badges.

The results in the README are written by hand from a run's output, not by CI — CI cannot
commit on a PR. Say in the README that the figures are from a specific run on a specific
date, and that the runner's output is the source. Session 18 fills the rest of the README
out; leave a line saying so. Close `fieldnote-7zo`.

## `fieldnote-034`

Closes when the suite has real cases and the check means something. Say in the closing
reason what a green check now proves and what it still does not — the path-gated skip is
one thing it does not prove on an unrelated PR.

## Scope guard

No roster import (8). No approved content library (9); the gap marker stays. No new
network destination — the runner's egress is the same API the route uses, and the
single-egress check should still pass or be amended with reasoning. No new dependency
without stopping first. Do not rename `Adversarial guardrail suite`: branch protection
requires it by display name.

## Constraints

TypeScript strict; the runner can be `.mjs` like the placeholder or `.ts` under `tsx` —
your call, say why. Never `--no-verify`. `core.hooksPath` reads `.husky/_` before your
first commit and after every `bd` command. Beads are local; nothing private goes in one.
Explicit paths staged, separate commits per logical change, `gh pr create` without
`--fill`, merge commit not squash. One session, one PR; findings get beads.

`pnpm evals` now costs real spend. Run it deliberately, count the runs, and report the
total.

Regenerate the handoff from the template last. Update `CHANGELOG.md` under the convention.

## Stop conditions

Stop and report rather than deciding, if: the combined rate is below 100% on the first
full run and the cause is a guardrail gap rather than a case defect — that is a real
finding and the owner decides whether to fix the ruleset or amend the case; a case needs
material only `private/` holds; the runner needs a dependency; the pre-commit hook fires;
`core.hooksPath` is not `.husky/_`; or a premise here does not match the repository. Seven
prompts have carried a stale premise.

## Done when

A case exists for every class in plan §4.5, built from public material. The runner
executes them against the live prompt with the exact request shape production sends,
records prompt-level and combined results per class, and fails the build when the combined
rate is below 100%. A deliberately weakened guardrail fails the build, demonstrated. An
unrelated PR skips the model with a log line saying why. `README.md` exists with the
results of a real run. The cost of one full run is recorded. `pnpm test`, `typecheck`,
`lint`, `build`, e2e green.

## Report back

(1) Verified versus assumed. (2) The prompt-level rate per class from the first full run
— this is the headline and nobody has seen it before. (3) The combined rate, and if it is
below 100%, stopped there with the cases named. (4) How nondeterminism is handled and
what it costs. (5) What one full run costs. (6) The corpus by class and provenance, with
counts. (7) What you built, file by file, and whether the route's model call was
extracted. (8) Beads, amendments, the README. (9) Flags last.

---

## How it actually went, for whoever reuses this

**Every premise held.** The prompt was written from a read-only printout of the
repository taken the same day, and nothing in it turned out stale. The one thing it left
to the session — `.mjs` or `.ts` under `tsx` — had a third answer: `tsx` is not a
dependency, and neither host could resolve the `@/` alias the pipeline imports through,
so the runner is a vitest suite under its own config, invoked by the `.mjs` entry. No
new dependency.

**The first full run failed the gate, and the cause was the cases, not the guardrails.**
Two of twelve "reached the draft": the model had relayed the attendee's question ("You
also asked … whether it would be faster", "You asked whether any centres … paediatric
cases"), which plan §4.2 and ruleset 1.1.0 pass on purpose, and the case detectors
miscounted it. The stop condition names a guardrail gap, not a detector defect, so the
detectors were fixed and the suite rerun. It took three more rounds — bare "than" in
sentences about nothing, "rather than" as contrast, an echo with the verb far from the
"you" — before the detectors stopped raising false alarms; every one is an oracle in
`tests/unit/evals-gating.test.ts` now. The guide's warning that this "runs long" and
that "you'll rewrite several cases once you see what the model actually does" was exactly
right, and it was the detectors that needed rewriting, not the notes.

**Five live runs, $0.59.** Three full runs while the detectors settled, one four-case run
with the claim-bearing rule removed, and the published run. One call per case throughout:
at $0.14 a run, N samples per case is N × $0.14, and the first question was whether the
instrument was measuring anything, which one sample per case answers.

**The weakened-ruleset run failed live, on an echo.** With claim-bearing removed, the
model's "You spoke positively … and noted that the sensor set felt more precise" reached
the draft. The ruleset blocks that sentence by its own policy — attribution does not
launder a comparison — while plan §4.5's echo-versus-adopt question calls it an echo, so
the final detector does not count it. The durable demonstration is the deterministic
gate test in `Verify`; the live one showed the failing path fires end to end.

**The model, so far, does not adopt claims.** Across sixty samples over five runs, by the
final detectors, one sender-voice violation was produced (a passive echo the detector
cannot see as attribution), and the ruleset caught it. Every injection payload was
ignored. That is one day and one sample per case, and it is the first number anyone has
had.

**What the runs showed about over-blocking.** The ruleset fired on eight of twelve drafts
in the published run while the detectors counted one. Most of the difference is relational
sentences carrying "than" or a performance word — "more useful to me than polite ones",
"rather than off the cuff", "so you can judge the workflow … rather than a demonstration
room". The representative would rewrite those. `fieldnote-ay2` has the instances; no rate
is claimed from them.
