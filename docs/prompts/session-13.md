# Session 13 — Calendar generation, ruleset 1.4.0, and the eval artifact

Written from session 12's report; checked at the start of the session, on `main` at
`2b863ea` after PR #46. One premise did not hold when the prompt arrived — PR #46 was
still open — and the session waited for the merge rather than stacking on the branch.
What was decided rather than read is in the how-it-went section at the end.

---

Session 13 — the calendar file, ruleset 1.4.0, and the eval artifact. On `main` after
PR #46. One PR.

Read before starting: `CLAUDE.md`; `docs/HANDOFF.md`; plan §3.3; ADR-0011;
`src/lib/preevent/compose.ts` and `PreEventScreen.tsx`; `src/lib/location/`;
`src/lib/generation/guardrails.ts` (the claim-bearing rule and `isClaimBearing`);
`tests/evals/corpus.ts` (the passage-verbatim detector); `.github/workflows/evals.yml`;
`bd show fieldnote-5nc`, `fieldnote-877`, `fieldnote-d8l`.

## Part 1 — Ruleset 1.4.0

`fieldnote-877`: a product sentence with a verb of state passes the claim-bearing rule
— "the console sits at eye level", "the system moves between rooms on its own stand",
"the display is designed to…" — because the rule's descriptor list and the detector's
predicate list differ. Close the gap in the rule, not the detector: a product noun in the
sender's voice with a stative or design predicate is claim-bearing. Read what the
detector counts and make the rule at least as strict, so the two agree on this class.
Expect relational false positives to rise ("the room sits at the end of the corridor"
has no product noun and must still pass — assert it).

Version 1.4.0 with a note naming the CI sample that found it. Adversarial cases in
`guardrails.test.ts`: the three sentences above blocked, the corridor sentence passing,
each with its counterfactual. The gate test in `Verify` gets the new shape. The detectors
stay frozen.

Then a held-out run, `EVALS_RUN=live EVALS_SAMPLES=5`, about $0.85. Report per class and
update the README's table with the date and versions. If any sample reaches the draft,
stop and report.

## Part 2 — The eval artifact

`fieldnote-d8l`: `evals.yml` uploads `evals-results.json` as a workflow artifact on
every run, pass or fail, seven-day retention, named with the run id. The workflow
comment says what the file holds — the model's text on the synthetic corpus, tokens
where names would be, nothing the repository does not already publish — and why it is
kept: a failed sample on a PR was undiagnosable without it. Actions are pinned by SHA
like the others.

## Part 3 — The `.ics`

`fieldnote-5nc`: the event has a start and no end. Schema v8: `EventRecord.endsAt:
number | null`, clear, a timestamp like `startsAt`. The composer's Location section
gains the end time; the event setup form may too if it is cheap. Migration, backfill
null, test.

The file, written by hand — RFC 5545 is stable and small, and a dependency for it would
need an ADR it does not deserve: `VCALENDAR` with `PRODID` and `VERSION`; one `VEVENT`
with `UID` (the event id at a fixed domain-shaped suffix, not a real domain), `DTSTAMP`,
`DTSTART` and `DTEND` in UTC with `Z`, `SUMMARY` (the event name), `LOCATION` (the
address), `GEO` (the coordinates), and `DESCRIPTION` holding the address and the two
map links and nothing else. **No free text in the description**: logistics prose would
be claim-bearing text leaving the device without the ruleset, so it stays in the email
body where the ruleset runs. No `ATTENDEE`, no `ORGANIZER`: the app holds no email for
either and would not put an HCP's address in a file if it did. CRLF line endings, 75-octet
folding, text escaping per the RFC, all unit-tested on the fixture event with a
line-by-line assertion — there is no parser to round-trip through and that is fine.

Download from the composer through the download helper, beside the site map; the button
is disabled until the event has an end time, and says so. The composed email says
"calendar invitation attached" when the event has an end time. The e2e spec downloads
it and records no network request.

## Scope guard

No forwardable block (14). No timezone database; UTC with `Z` and the phone converts.
No `ATTENDEE`. No change to the prompt or the pseudonymizer. The eval gate runs live on
this PR because the ruleset changed; that is expected.

## Bookkeeping

Close `fieldnote-5nc`, `fieldnote-877`, `fieldnote-d8l`. Guide session 13 amended on
completion. README table updated from the held-out run. Handoff regenerated; changelog;
prompt file with how-it-went.

## Stop conditions

As every session. Stop if the held-out run fails the gate; if the stative-verb rule
cannot be written without blocking the corridor sentence; or if a premise here does not
match the repository.

## Done when

1.4.0 blocks the three stative sentences and passes the corridor one, with
counterfactuals. The held-out run is clean and the README says so with the date. CI
keeps the results file. The `.ics` downloads, validates line by line against the
fixture, and carries no free text. Unit and e2e green; eval green on the PR.

## Report back

(1) Verified versus assumed. (2) The held-out figures per class, and what over-blocking
did. (3) The `.ics` for the fixture event, pasted. (4) File by file. (5) Beads, guide.
(6) Spend. (7) Flags.

## How it actually went, for whoever reuses this

**The premise that failed was the starting point, not the content.** "On `main` after PR
#46" arrived while #46 was open. The session stopped and said so; the owner merged; the
session started. Every other premise held.

**1.4.0 was written from the two instruments, not from the sentence.** The CI sample that
found the gap was never seen, so the rule was reconstructed from what the detector counts
and what the rule needed, and the three sentences the prompt named were the adversarial
cases. The counterfactual for two of them is the 1.3.0 classifier — noun and descriptor —
which lets them through; the third has "designed", which 1.3.0 already caught, and is
kept because the prompt named it as the shape. A fourth, the probe-port shape, is there
because "port" was not a product noun and the detector names it. The noun list grew by
seven parts for the same reason. The corridor sentence passes, and so do two more with
the verb and no product noun.

**The held-out run: 0 of 70 reached, 4 of 70 produced, $0.81.** Hospitality produced on 3
of 5 (the model declining a meal in writing, blanked), off-label on 1 of 10, the rest
nothing. Every sample of both passage classes quoted exactly. The ruleset fired on 34 of
70 samples, against 29 of 60 under 1.2.0 — the over-blocking the prompt said to expect,
in the accepted direction. Every detector was frozen before the run, so every row is held
out this time.

**Two denylist findings, one by the calendar file.** The `.ics` `UID` is the event id at
`fieldnote.invalid`, and the structural email pattern read it as an address. `.invalid`
can never resolve, by the RFC that reserves `example.com`, so the allowlist gained it —
its own commit, with the probe run both ways. And a commit swallowed the still-staged
calendar files when the denylist had refused them a moment earlier; the commit was split
before anything was pushed, and the lesson is in the handoff.

**Decisions made in the session rather than read.** The fold counts the continuation's
leading space toward its 75 octets and never splits a multi-byte character, and the test
asserts the folded lines exactly. `DTSTAMP` is an input, so the file is testable. The
times are entered on the pre-event screen's Location section, both together, because the
event setup form has never held a date and adding one there would have been a second
place for the same field. `GEO` is written at six decimals with a semicolon. The
`DESCRIPTION` escapes its commas, which makes the map links look odd in the raw file and
correct in every calendar app.

**Spend.** One held-out run, $0.81; the CI runs on the PR at about $0.16 each.
