# Session 14 — The invite feature: the forwardable block behind its flag

**No Guardian prompt existed for this session.** The prompts README says prompts are
written by Guardian, a separate Claude instance with no view of the repository, so that
the plan and the outcome can be compared. This one was written in the session, by the
instance that then built it, from the guide's entry, ADR-0002, ADR-0011, the session 13
handoff, and the composer's placeholder — after the owner asked whether it could be done
to the usual standard without Guardian and was told yes on the code, with this gap in the
process named and recorded. Read the "how it actually went" section with that in mind:
the premises below were verified against the repository before they were written, which
is not the same thing as a plan written before contact with it.

---

Session 14 — the invite feature. On `main` after PR #47, at `aaed981`. One PR.

Read before starting: `CLAUDE.md`; `docs/HANDOFF.md`; ADR-0002 in full; ADR-0011;
`src/lib/preevent/compose.ts` (the placeholder) and `PreEventScreen.tsx`;
`src/lib/generation/approved.ts` (how passages are held out of the rules);
`src/lib/db/schema.ts`, `migrations.ts`, and `tests/unit/migration-v8.test.ts`.

## The flag

Schema v9: `EventRecord.forwardableEnabled: boolean`, clear, `false` on creation and
backfilled `false` — the feature ships disabled and enabling it is a per-event action,
ADR-0002's fifth constraint. A repository function turns it on for one event.
Migration with a test; the older migration tests' event shapes omit the field.

## The block

Fill the composer's placeholder. When the flag is on, the email's last section before
the sign-off is a self-contained block the recipient can pass on as it stands: the
event's name, when, where, her logistics, and the passages she selected, between a
heading, an opening line, a closing line, and an end marker. Nothing else: no input of
its own, no attachment lines (an attachment does not travel with a forwarded block), no
URL but the two map links. It goes through the ruleset with the rest of the body.

## The constraints, each a test

ADR-0002 says "all enforced in code rather than by policy". Write the tests first: no
tracking or unique URL (the same block for every recipient and every composition, the
map links its only URLs); no incentive and no collection of details (the fixed strings
are the only text that is not a record field, and they pass the ruleset clean); approved
content only (a comparison in the logistics is a gap in the block too, the passages
exact and counted once); ships disabled (an event with the flag off composes exactly the
email it did before, and `createEvent` and the migration both say `false`).

## The screen

A switch between the recipients and Compose, saved as it is toggled. The end-to-end spec
switches it on, composes, and reads the block in review.

## Scope guard

No new ADR: ADR-0002 is the decision and is amended with where each constraint is
enforced. No change to the prompt, the ruleset, the pseudonymizer, or the calendar file.
No application-level switch — per event only.

## Bookkeeping

A bead for the session, closed on completion. Guide session 14 amended on completion.
ADR-0002 amended; the index updated. Handoff regenerated; changelog; this file with
how-it-went.

## Stop conditions

Stop if a constraint cannot be made a failing test; if the block needs text that is not
a record field, a fixed string, or a map link; or if a premise here does not match the
repository.

## Done when

The flag is off on every event until turned on for that event. The block appears only
then, is the same for every recipient, carries the two map links and no other URL, and
blanks a typed claim as the body does. Five constraint tests, the migration test, the
repository test, and the end-to-end spec green. Phase 3 closes.

## How it actually went, for whoever reuses this

**Every premise held**, which is what verifying them against the repository first buys
and also what makes this a weaker record than the others: nothing was found to be false
because nothing was written before looking.

**The eval gate runs live on this PR** for a reason the scope did not anticipate. The eval
runner's synthetic event is typed as the record, so it gained the new field, and
`tests/evals/` is a watched path. About $0.16, once. Nothing the model sees changed.

**Two decisions made in the session rather than read.** The block omits the attachment
lines, which ADR-0002 does not mention: "Site map attached." forwarded to a colleague who
received no attachment would be wrong. And the when line is in the composing device's
zone, as prose, with the end's date repeated only when it differs from the start's — not
UTC, because the block is for a person, not a calendar application.

**One thing the browser knew and Node did not.** Chromium writes the en-GB long date as
"Friday, 2 October 2026" with a comma; the end-to-end assertion was written without it
and corrected from the failure. And a controlled checkbox whose state lives on the event
record does not flip until the save returns, which Playwright reads as a click that did
nothing; the switch mirrors the flag in local state, as the other fields do.

**Spend.** No local eval run: the ruleset and prompt are unchanged. The CI run on the PR
at about $0.16.
