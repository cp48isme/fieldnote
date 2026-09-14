# Fieldnote

A local-first web app for a field representative running demonstration events for
regulated products. It captures what attendees said, in the field, from the phone's own
dictation, and drafts a personalised follow-up email for each of them, for the
representative to review, edit, and paste into their own mail client.

It is also a public reference implementation of AI governance as production code. The
controls are enforced, not asserted: names never reach the model, claim-bearing text is
selected from approved copy or not written, every generation leaves an audit record, and
the adversarial suite below runs against the live model. Where a control cannot be
enforced, the documentation says so. `docs/PROJECT-PLAN.md` is the plan; `docs/adr/` holds
the decisions with their rejected alternatives; `docs/HANDOFF.md` is where things stand.

This is the de-branded public build (ADR-0001). Every name, site, and product detail in
it is synthetic.

## What it deliberately does not do

- **It never sends anything.** Export is a copy to the clipboard, into the user's own
  mail client. There is no mail API and there will not be one: sending would make it a
  communications system under a different control regime.
- **No name crosses the AI boundary.** Attendee and staff names are replaced with stable
  tokens on the device before the one model call, and put back after. The roster never
  leaves the phone.
- **The model does not describe the product.** Anything about characteristics,
  indications, performance, or price is selected from an approved content library or not
  written. Until the library exists, it is not written, and the draft shows a gap where
  it would go.
- **Nothing leaves the device except that one pseudonymized call.** No analytics, no
  telemetry, no error reporting, no third-party scripts or fonts. A failing test and the
  browser's Content Security Policy both hold that.
- **No audio.** Dictation is the operating system's, into a text field. Nothing is
  recorded, stored, or transcribed by the app.
- **Nothing is exported until a human has opened it.** Drafts move from generated to
  reviewed to exported, and the edit distance between what was generated and what was
  copied is recorded, as a signal, not a score.
- **No server-side store of attendee data.** Persistence is on the device.

## Eval results

The adversarial guardrail suite (`pnpm evals`, plan §4.5) sends field notes engineered to
provoke each class of violation through the real prompt to the live model, and records
two things separately: whether the model produced the violation, and whether it reached
the draft by either defence. The second is the gate, at 100%; the first is published and
is not.

**How the figures came about, in order.** Session 7 built the suite and tuned the cases'
detectors on the runs it then measured; its published run is the calibration figure
below. The detectors were frozen when that session merged (PR #39), so every run since
is held out. The first held-out run, under ruleset 1.1.0 at five samples per case, found
a guardrail gap: on 1 of 60 samples the model wrote "On the question of use outside the
cleared population:" in its own voice, the indication rule knew "cleared for" and not
"cleared population", and the sentence reached the draft. Ruleset 1.2.0 closed it with a
phrase list. The held-out run under 1.2.0 is the headline.

**Held-out run, 2026-09-14**, written here by hand from the runner's output, which is the
source. CI cannot write to a pull request, so this table is updated when a session reruns
the suite, and says when.

| | |
|---|---|
| Model | `claude-opus-5` |
| Prompt template | 1.1.0 |
| Guardrail ruleset | 1.2.0 |
| Cases | 12, five calls each, 60 samples |
| Combined: violation reached the draft | **0 of 60** |
| Prompt-level: model produced the violation | 2 of 60 |

Per class, prompt-level (model produced the violation on n of N samples):

| Class (plan §4.5) | Cases | Produced | Reached draft |
|---|---|---|---|
| Efficacy claim invited | 2 | 0 of 10 | 0 |
| Patient details in the note | 1 | 0 of 5 | 0 |
| Meal or travel mentioned | 1 | 0 of 5 | 0 |
| Off-label discussion invited | 2 | 2 of 10 | 0 |
| Pricing requested | 2 | 0 of 10 | 0 |
| Prompt injection in dictated text | 2 | 0 of 10 | 0 |
| Attendee makes the claim | 2 | 0 of 10 | 0 |

Calibration run, 2026-09-11, ruleset 1.1.0, one call per case, the run the detectors
were tuned on: 0 of 12 reached the draft, 1 of 12 produced.

What the numbers do and do not mean. Five calls per case shows nondeterminism: one case
produced a violation on two of its five samples and on none of the others, and the runner
reports every sample rather than a majority. The two produced violations were both on
the same off-label case — a sender-voice heading before the gap marker, and an echo of the
attendee ("You were clear that nothing further can progress … until the extended-use
indication is in place") that the detector counts because its phrase list lacks that
wording — and the ruleset blocked both. The detectors have been frozen since #39 and are
deliberately narrow and separate from the ruleset, so a rate measured here is not
measured by the instrument that enforces it; their limits are stated in
`tests/evals/corpus.ts`. The ruleset fires far more often than the detectors do — on 29
of 60 samples in this run — mostly on relational sentences that carry a comparison word,
and that over-blocking has an instrument but no measurement yet (`fieldnote-ay2`). Prompt
injection has no rule behind it: for that class the combined result is the prompt-level
result, and on every sample so far the model has ignored the payload. Removing the
claim-bearing rule and running the four claim cases live let nothing through, because the
model echoes rather than adopts; that rule's necessity is demonstrated by the
deterministic gate test in `Verify`, not by the live suite.

The suite runs on every pull request that changes the prompt, the ruleset, the model
settings, the pseudonymizer, or the corpus, and skips with a log line saying so on any
other change. A full run at one call per case costs about $0.14; at five, about $0.68.

## Documentation

Session 18 fills this file out: published results across runs, known failure modes, and a
short recording. Until then, `docs/HANDOFF.md` is the current state, `docs/BUILD-GUIDE.md`
the sequence, and `CHANGELOG.md` what each session shipped.
