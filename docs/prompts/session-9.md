# Session 9 — Approved content library

Written from a read-only printout of the repository taken 2026-09-14; checked again at the
start of the session, on `main` at `edb292a` after PR #43 and the update to #42. No premise
was wrong. What was decided rather than read is in the how-it-went section at the end.

---

Session 9 — the approved content library. On `main` at `edb292a`. One PR.

Read before starting: `CLAUDE.md`; `docs/HANDOFF.md`; plan §4.2 and §4.4; ADR-0008;
`src/lib/db/schema.ts` (`ApprovedContentRecord`, `AuditRecordRecord`);
`src/lib/generation/` in full; `src/app/api/generate/route.ts`; `tests/evals/corpus.ts`;
`bd show fieldnote-ay2`, `fieldnote-frx`, `fieldnote-quj`. Then `private/approved-content
-brochure.md`, including its notes section — read it, build from its shape, and put none
of it anywhere the repository tracks.

## What the printout settled, verified 2026-09-14

- The table exists: `label`, `body`, `sourceRef`, all clear, indexed on `id` and
  `updatedAt`, no repository function touches it.
- `applyGuardrails` is sentence-by-sentence with no notion of a passage; `isClaimBearing`
  fires identically on a quoted passage and a reworded one.
- Prompt 1.1.0 tells the model there is no approved wording. Ruleset 1.2.0's
  claim-bearing rule says "there is no library yet, so not written."
- Nothing distinguishes verbatim from paraphrase today, and the honest floor is exact
  match after normalisation. Anything looser is a second heuristic with an indefensible
  threshold, and a paraphrase that scores high is the thing §4.2 blocks.

## The owner's decisions

- **The library is a list of discrete passages, entered one at a time.** Label, body,
  source reference. The source reference holds the approving document's code and
  version, per passage. No bulk upload this session.
- **The regulatory passage is a passage like any other.** Selectable by the
  representative through the model like the rest; not appended automatically, not
  excluded.
- **The public build ships with an empty library and synthetic fixtures.** The
  representative loads real passages in the private fork.

## The matcher

**Exact match, whole passage, after normalisation** — whitespace collapsed, Unicode
quotes and dashes folded to ASCII, case preserved. Nothing looser. A passage the model
reworded by one word is not approved copy and is blocked as claim-bearing, with the gap
marker, which is §4.2 working: the representative sees where the model tried and
selects the passage herself if she wants it.

**Approved spans are exempt from every rule**, not just claim-bearing — the regulatory
passage carries indication language by nature. To keep that exemption honest, **the
library refuses a passage at load time** if the pricing, hospitality, patient, or
invented-name rule fires on it, or if the pseudonymizer's structural guard would reject
it. The refusal names the rule. Approved copy that mentions a meal is not approved copy
for a follow-up.

**Mechanism.** A pass before the sentence rules: find every span in the model's text
equal to a library passage, replace it with an indexed placeholder in the pseudonymizer's
style, run the sentence rules, restore the passages. Whole passages only; a passage's
sentence quoted alone does not match. Lives in `src/lib/generation/` so the eval gate
watches it.

## The prompt

Template 1.2.0. When the library is empty the system prompt keeps today's instruction
word for word — "there is no approved wording available to you" — so the empty-library
path is unchanged. When it is not, that paragraph becomes: select from the passages
listed, copy each one exactly with no change to any word, and where none fits write the
gap marker. The user message lists the passages with their identifiers after the notes.
The version note says what changed and why.

Passages travel in the request. `GenerateRequest` gains `passages: { id, body }[]`; the
route's schema validates them with length caps; the pipeline takes the library as a
parameter alongside the attendees, never reading the database itself, so the eval runner
can pass fixtures. `inputHash` already covers the request body, so the passages sent are
already in the audit trail's provenance.

## The audit record

`AuditRecordRecord` gains `passagesUsed: string[]` — the ids matched in the draft — and
`libraryVersion: string | null` — a SHA-256 over the library's passage bodies at
generation time, null when empty. Schema v5, migration backfilling `[]` and null.
ADR-0008 gets a dated note: what approved copy a draft carried is now recorded, and how.
`DraftRecord` does not change; the detail view reads the audit record and shows a line
"N approved passages used" when N is greater than zero.

## The library screen

Reached from the event switcher's list, the pattern of the last two sessions. Passages
listed by label; add, edit, remove. A removed passage stays referenced by id in any
audit record that used it — the record survives (ADR-0008); the screen says so on
remove. Load-time refusals shown inline with the rule that fired.

## Fixtures and the corpus

**Every public passage is invented about the synthetic device** — the open control
panel, the sensor set, the probe port, the tooling kit — written fresh. Not adapted: for
product copy the shape is the product, and a brochure sentence with the name swapped
still describes a device an industry reader identifies. No sentence structure, phrase
order, or paragraph shape from the private file. Four or five fixture passages,
including one regulatory-shaped one about the synthetic device.

The eval corpus gains two classes, with the fixture library passed to the runner:
`passage-verbatim` — a note that invites a product description, with the assertion
that if the draft carries a library passage it carries it exactly and unblocked; and
`passage-paraphrase` — the detector counts any claim-bearing sentence outside an
approved span, so a reworded passage is a produced violation the ruleset must catch.
The prompt-level number for the first class is a new headline: how often does the
model quote exactly when told to? `VIOLATION_CLASSES` grows; the README's table gains
the rows after a held-out run at N=5 on this branch, cost noted.

Ruleset 1.3.0, for the passage exemption, and with one narrow fix folded in from
`fieldnote-ay2`: STRONG_CLAIM's bare "than" excludes "rather than" — the single largest
cause of over-blocking in the held-out runs, contrast not comparison. An adversarial case
in `guardrails.test.ts` with its counterfactual. Nothing else in the ruleset changes.

## Folded in

`fieldnote-frx`: the dock classifies a typed Dr or Prof as `hcp`, the rule import
already uses. No toggle. Close it.

## Scope guard

No bulk upload. No fuzzy matching of any kind. No change to the pseudonymizer. No photo,
no briefing. No new dependency. The private file is read and nothing from it is written
anywhere tracked — not a fixture, not a test string, not a bead, not a commit message.
Run the denylist before every commit and say so.

## Constraints

As every session. `core.hooksPath` before the first commit and after every `bd`
command. Explicit paths, separate commits — schema and migration; the matcher; the
prompt; the route and pipeline; the screen; fixtures and eval classes; the ruleset fix;
docs. Merge commit. Write escapes, not literal control characters. Match with whitespace
tolerance when editing prettier-formatted files.

`pnpm evals` costs spend: the held-out N=5 run for the README is about $0.85 with the
two new classes. Count the runs and report the total.

## Stop conditions

Stop if: the contract change cascades beyond the route, the client, and the pipeline;
the placeholder pass interacts with the pseudonymizer's own placeholders; a fixture you
have written reads to you as recognisable from the private file; the held-out run fails
the gate on a case that is not a detector defect; or a premise here does not match the
repository.

## Done when

A passage entered in the library, sent in the prompt, quoted exactly by the model,
passes through the guardrails unblocked and is recorded on the audit record by id; the
same passage reworded is blocked with the gap marker. A passage that mentions a meal is
refused at load. The empty-library prompt is today's prompt. Two eval classes run live
and their rows are in the README from a held-out N=5 run. `fieldnote-frx` closed.
Unit, e2e, eval green on the PR.

## Report back

(1) Verified versus assumed. (2) The prompt-level rate for `passage-verbatim` — the new
headline. (3) What normalisation the matcher applies and one case it deliberately does
not match. (4) What you built, file by file. (5) Beads, ADR-0008's note, the guide
amendment. (6) Spend. (7) Flags last.

## How it actually went, for whoever reuses this

**No premise was wrong.** The printout the prompt was written from was taken the same day,
and every file, field, and function it named was where it said. The private material was
read first and its shape decided the session as the guide's amendment said it would; none
of it is in any tracked file, and the denylist ran before every commit and on the whole
tree at the end.

**The commit order moved once.** The prompt put the ruleset fix last; it went second,
because the exemption for approved spans lives in the ruleset (1.3.0) and the matcher
cannot be tested without it. Everything else landed in the prompt's order.

**The held-out run took three runs, and the two extra were the measurement's fault, not
the guardrails'.** The first, all fourteen cases at five samples, gave the twelve existing
classes their figures — 0 of 60 reached — and crashed the two new classes: the runner had
held the library out before the rules and handed the guarded text, placeholders still in
it, to a detector that holds the library out again on its own, and the second pass met
placeholders it had not written. The judge now restores the passages after the rules, as
the pipeline does, and the matcher leaves a foreign placeholder alone. The second run, the
two new classes only, gave three false alarms, every one a relational sentence that names
a part and says nothing about it — a subject line, "the questions you put to us about the
control console", "your request for a plain, one-line description of the sensor module".
The detector counted a mention; it now requires a predicate after the part name, which
still catches a reworded passage, and the three sentences are in the gating test. The
third run: 0 of 10 produced, 10 of 10 quoted exactly. Because both fixes happened in the
session, the two new rows in `README.md` are not held out the way the other twelve are;
the README says so and the next run is.

**What the first run also showed.** Under prompt 1.2.0 the hospitality case produced on 3
of 5 samples where the earlier run had 0 of 5: the model declined the meal in writing,
which the detector counts as a mention and the ruleset blanked. Off-label produced the
same echo as before, 3 of 10, caught. Both are in the README.

**Decisions made in the session rather than read.** Normalisation folds curly quotes and
the dash family to ASCII one character for one, so an index into the folded text is an
index into the original and the draft's own line breaks stay where the model put them;
an ellipsis is deliberately not folded, and a case change is deliberately not matched. The
route protects approved spans before its private-term rule, because real approved copy
carries the product's own name (`fieldnote-quj`). The draft's opening line is taken after
the passages are restored, so no placeholder ever crosses into a stored opening. The
library screen resets the other two views when it opens, and closing it returns to
whichever of capture or follow-ups was showing, which the e2e spec relies on.

**Spend.** Three live runs: $0.68 tallied for the first (its ten crashed samples were
generated and not tallied, about $0.13), $0.13 for the second, $0.13 for the third. About
$1.05 in all against the prompt's ~$0.85; the difference is the two reruns.
