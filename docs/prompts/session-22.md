# Session 22 — Retention, implemented

**Process note.** Guardian wrote this prompt — the separate Claude instance that reviews
the work and drafts the prompts, with no shared context and no direct view of the
repository.

**The prompt arrived truncated.** It ended mid-sentence in Part D, at "the consequence
that audit records grow without bound, by", with no rest of Part D, no Part E, no Part F,
no scope guard, no stop conditions, and no report-back specification. The session stopped
there and said so, which was also where Part A independently asked it to stop: "Report
your reading of these six back before writing code." The owner confirmed the truncation
was in transit, accepted the reading and the schema decision, and sent the rest. Both
halves are below, in the order they arrived.

**On what is missing from this file.** As in sessions 21 and 23, the private repository's
name, the Vercel project, and every deployment URL or domain appear nowhere here, in the
commits, or in any bead.

---

Session 22 — Retention, implemented. Public repository cp48isme/fieldnote, then a sync of
the private repository. Stops means stops.

## Ground rules
Every earlier rule stands: the private-material sentence; no approval language; no
person named ("the representative"); the private repository's name, the Vercel project,
and every deployment URL or domain appear nowhere in the public repository, its commits,
PRs, or beads; you never see a secret.

## Part 0 — Verify
main at 2aa1d42 or a descendant; tree clean; the local-only bead checks before the first
bead command and after the last; `lsof -iTCP:3000` clear before any e2e run.
Read in full: fieldnote-iox, including its 2026-09-17 notes, which are the decision and
are not to be reinterpreted; fieldnote-tcq; fieldnote-jqk; fieldnote-cdx;
src/lib/db/schema.ts; src/lib/db/repository.ts, deleteEvent in particular;
src/lib/db/migrations.ts; ADR-0004 and ADR-0008; docs/DATA-PROTECTION.md §4;
docs/BUILD-GUIDE.md's session 22 entry.
Before writing code, run the watched-path check against every file you expect to change
and report it. If anything is watched, stop.

Branch feat/session-22-retention.

## Part A — The decision, as decided
From fieldnote-iox's 2026-09-17 notes:
- SCOPE: an event's content — attendees, notes, drafts, contacts, images, and the event
  itself: what deleteEvent cascades to today.
- AUTOMATIC DELETION: 30 days after the event ends. The clock keys on endsAt; if null,
  startsAt; if both null, the event's updatedAt.
- WARNING: from day 23, the app shows a notice on the event saying its content will be
  deleted, and the date it will be.
- HER DELETE: at any time, as today.
- AUDIT RECORDS: kept, never pruned. ADR-0008.
- PERIODS: build-time constants, not a user setting.
Report your reading of these six back before writing code. If anything in the bead
contradicts this, stop and report rather than choosing.

## Part B — The schema question, answered before any code
Decide, and say which and why in the report: whether anything must be stored — a due
timestamp, a warned-at timestamp, a dismissed-at timestamp — or whether the rule is
computed from the event's existing fields on every load. Prefer computed if it is
sufficient; a stored field is a schema version and a migration with a test, and the
schema has stayed at v9 through three sessions for good reasons. State what a computed
rule cannot do that a stored one could, so the choice is visible rather than implied.

## Part C — Build it
- The periods as named build-time constants in one module, with the clock's fallback
  order in one function, so the rule and its tests agree by construction.
- Deletion runs on load, for every event past due, not on a timer: a phone-installed app
  is not running when it is closed, and a `setInterval` that only fires while she is
  looking at it is a rule that does not hold.
- Deleting an event's content reuses deleteEvent's cascade. Audit records survive; assert
  it.
- The notice appears on an event from day 23 and states the date. It is a notice, not a
  prompt: no export offer, no dismissal that changes the outcome.
- Nothing in this session changes what she can delete by hand, or the cascade's shape.

Tests, unit, each named for the rule it holds:
- due at 30 days from endsAt; not due at 29
- the fallback to startsAt when endsAt is null; to updatedAt when both are null
- the notice from day 23, and not at day 22, with the date it states
- deletion removes the event's content and the audit records survive
- the periods are constants, and the rule reads them rather than repeating the numbers
End-to-end: an event whose clock is set past due is gone after a load, and its audit
records are still there; an event inside the warning window shows the notice with a date.

## Part D — The ADR (as sent after the truncation)
ADR-0013, retention of the local store, written by hand in the register of the others:
- The decision as the owner made it, dated 2026-09-17, in its six points.
- The alternatives rejected, with the 2026-09-16 decision recorded as superseded and
  why: no export prompt and no 60-day ceiling, because the correspondence that leaves by
  her mail client is the record kept elsewhere and the app's copy is working material.
- The schema decision and its two limits, as you reported them: no dismissed-at, so the
  notice shows throughout the window, which suits a notice rather than a prompt; and
  after deletion nothing distinguishes retention from her own delete, which is accepted
  rather than overlooked.
- The consequence that audit records grow without bound, by decision, pointing at
  ADR-0008.
- What it does not settle: the two deletion limits (fieldnote-jqk, fieldnote-cdx), both
  still open owner decisions, and that nothing outside the app is covered — a briefing
  PDF, an audit CSV, or an email already sent is not reached by this rule.
Update docs/adr/README.md's index and summary, and CLAUDE.md's ADR list. ADR-0004's
retention consequence points at ADR-0013.

## Part E — Correct session 23's dates, then record
Session 23's work happened on 2026-09-22 — its CI runs are stamped that day — but it was
recorded as 2026-09-23 in ADR-0012's second amendment and the index row, the handoff,
docs/prompts/session-23.md, and fieldnote-cno's close reason. Correct each to 2026-09-22.
For the bead, append a dated note recording the correction if the tool will not edit a
close reason; say in the report which you did.

Then: docs/DATA-PROTECTION.md §4 reads as built rather than as decided-and-not-built, and
anywhere else in that document or the threat model that says retention is not implemented;
say which you changed. The guide's session 22 entry amended on completion. The handoff
regenerated from the template. Changelog line. docs/prompts/session-22.md with this
prompt, the truncation and the stop recorded, the process note that Guardian wrote it,
and how it went.
Close fieldnote-iox with the tests named. Bead checks around every write.
Leak grep for the private repository's name, the production domain, and any vercel.app
host: zero hits or stop.
Watched-path check against the diff (none), unit and e2e green, push, gh pr create (never
--fill), four checks with the eval gate skipping, merge with a merge commit.

## Part F — Sync the private repository (this deploys production)
As session 23: fetch upstream in the private clone, confirm the private main is an
ancestor of upstream/main, merge --ff-only, push. If a fast-forward is not possible, stop.
Report both HEADs, equal, with the private name redacted. Then against the production
domain: the security headers and x-robots-tag unchanged; POST /api/generate with no
cookie still 401 "This device is not authorised."

## Scope guard
No change under a watched path. No new dependency. No change to the cookie, the access
decision, the pseudonymizer, the ruleset, or the prompt template. No change to what
deleteEvent cascades to (fieldnote-jqk and fieldnote-cdx stay open). No export prompt and
no ceiling: the 2026-09-16 decision is superseded.

## Stop conditions
A premise does not match the repository or the bead; a watched file would change; a
schema change proves necessary after all; a private name, URL, or domain would enter the
public repository.

## Report back, raw output
1. The watched-path check against the final diff.
2. Every changed source file's diff in full.
3. Test names added, unit and e2e counts.
4. ADR-0013 in full.
5. The date corrections, each file and line.
6. The PR, the four checks and the skip line, the merge commit.
7. Part F: both HEADs, the deployment checks.
8. The bead checks; bd show fieldnote-iox after.
9. Anything that met a stop condition.

---

## How it actually went, for whoever reuses this

**The truncation was the only stop, and it was not the repository's fault.** Everything
the prompt asserted about the code held: `main` at `2aa1d42`, the beads as described,
`deleteEvent` cascading to the five tables the decision names.

**One thing about the bead is worth knowing before reading it.** `fieldnote-iox`'s
*description* still carries the superseded 2026-09-16 decision, export prompt and
sixty-day ceiling included, and its "what closes this bead" list in the description names
them too. The 2026-09-17 note replaces both and says so, with a corrected closing list.
Reading the description alone would build the wrong thing. The prompt was right to say
the notes are the decision, and the session flagged the discrepancy before writing code
rather than after.

**The schema answer was computed, and the interesting part is what it cannot do.**
Everything the rule needs is already on the event, so there is no migration and the schema
stays at v9. What that gives up is a dismissed-at, so the notice repeats through its
window, and any way to tell afterwards whether retention or she deleted an event. The
first suits a notice. The second is a real limit, and the reason to accept it is that an
audit record exists to prove a generation happened, not to explain why an event left. Both
are in the ADR so that a later reader meets them as decisions rather than as surprises.

**The rule's shape came from the failure mode, not from convenience.** On a timer it would
delete only while she was looking at the screen, which is the one time she is working; on
load it deletes at the first opportunity the application has. The cost is that the date is
when deletion becomes due, not when it happens, and a phone left closed holds the content
until it is opened. That is stated in the ADR, the assessment, and the guide rather than
left for someone to notice.

**Two things the environment threw up.** The Playwright browser binary was missing after
session 20's dependency bump and had to be reinstalled before any end-to-end run — worth
expecting after any Playwright version change. And the first `pnpm build` failed on a type
error in the new unit test rather than in the source, because `NewDraftInput` requires
`guardrailRulesetVersion` and the fixture omitted it; the build is what caught it, not the
test run, since Vitest does not typecheck.

**The period changed after the checks were green, and that is the useful part.** The
owner set it to fourteen days, notice from day seven, while the pull request sat waiting
to merge. The source change was two constants. Nothing else in `src/` moved, because the
rule reads the constants and the notice is written as a gap subtracted from the period
rather than as a day number, so the window kept its shape instead of landing after the
deletion. The unit tests needed the two literals in the one case that pins the decision
and nothing else: every other case already named the rule. The end-to-end spec restates
the periods at the top, because importing the module there would pull Dexie into the Node
process, and each fixture age is written against them. The rest of the work was prose —
the ADR, the assessment, the threat model, the index, this guide entry, the changelog.
Worth knowing if a period ever moves again: the code is cheap and the documents are not.

**Spend.** $0. No watched path changed, and the end-to-end retention case mocks the model
route exactly as the review suite does.
