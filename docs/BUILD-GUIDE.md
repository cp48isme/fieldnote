# Build Guide

Session-by-session build order. Each session is one sitting of two to four hours with
a single goal, a definition of done, and a commit. Stop at the end of a session even if
you have momentum — the commit boundaries are what make the history readable, and the
history is part of the artifact.

Estimates assume you're working with Claude Code and already know Next.js. They are
generous where I've seen things reliably take longer than people expect, and I've
flagged which those are.

> **Revised 2026-09-01.** Sessions 2, 3, and 5 changed after the encryption and
> dictation decisions (ADR-0004, ADR-0005) and after two plan §5 non-negotiables were
> found to have no session attached. Session 8's library changed per ADR-0003. Phase 1
> is now ~22 hours. Session 19 is new and private-fork only.

---

## Phase 0 — Foundation

### Session 1 — Scaffold and governance skeleton
*~2 hours* — **complete, 2026-08-28**

Repo, Next.js scaffold, CI, security settings, empty doc tree, both ADRs, CLAUDE.md.
Nothing works yet. That's correct.

Wire `evals.yml` now with a single trivially passing case so the badge exists from the
first commit and every later guardrail change has to clear it.

**Done when:** `main` is protected, CI is green, both badges render in the README, and
the ADRs are committed.

**Commits:** `chore: scaffold`, `docs: ADR-0001`, `docs: ADR-0002`, `chore: CI and
security baseline`

> **As built, it went further than this:** three ADRs rather than two (ADR-0003 replaced
> the SheetJS dependency), a pre-commit denylist hook, and a repository secret for the
> CI key. Note that the eval suite currently passes against zero cases — the green check
> is evidence the wiring works, not that any guardrail holds. No eval badge in the README
> until session 7 lands real cases.

---

## Phase 1 — Core, built properly

This is the phase that matters. Everything after it is additive. If you shipped only
Phase 1 it would still be a defensible portfolio piece.

### Session 2 — Data layer and persistence
*~3.5 hours*

Dexie schema for `Event`, `Attendee`, `Note`, `Draft`, `AuditRecord`, `VoiceProfile`,
`ApprovedContent`, `Settings`. Migration scaffolding and schema versioning. Debounced
autosave. Crash recovery on load.

This directly fixes the failure the representative hit in the prototype. Build recovery first and
the rest of the app inherits it.

**Also in this session, per ADR-0004:** all persistence routes through a single
data-access layer — no feature code touches Dexie directly — with `encrypt` and
`decrypt` hooks implemented as identity pass-throughs, and every schema field marked
encryption-eligible or not. This is the only part of encryption-at-rest that is
expensive to retrofit, and it is nearly free while the schema is being written. Give the
pass-through hooks a round-trip unit test so the seam is exercised rather than merely
present; dead code rots.

**Done when:** you can create an event, close the tab mid-typing, reopen, and find
everything including the half-finished note. No module outside the data-access layer
imports Dexie, and a test asserts the encrypt/decrypt round trip.

### Session 3 — Capture UI and offline shell
*~4 hours*

Port the prototype's capture dock and log. It's already validated — don't redesign it,
just rebuild it on the real data layer with proper components and types.

> **Amended 2026-09-02, in the session that built it.** This did not happen. The prototype
> was a Claude artifact built outside this repository, it was not retrieved, and the
> capture surface was built fresh from plan §3.1 instead. "Already validated — don't
> redesign it" was the load-bearing half of the instruction above, and it no longer holds:
> the layout in the repository has never been in front of the representative, so her
> reaction is deferred validation rather than validation already banked. The commit
> messages, the PR, and the handoff say *built*, not *ported*, for the same reason a green
> eval badge over an empty suite would be wrong.

**Plus the service worker and PWA manifest** (plan §5, non-negotiable 5). It had no
session and capture is the first thing that has to survive a dead signal, so it lands
here. Budget about an hour of the four for it.

Capture is also where dictated text arrives. Per ADR-0005 the app records no audio and
knows nothing about dictation — but the textarea has to be comfortable to *correct* text
in, one-handed, standing up, because OS dictation will mangle surnames and punctuation
and there is no source recording to fall back on.

> **Amended 2026-09-08, after the first hardware run.** "Will mangle surnames" is stated
> more strongly than the evidence supports, and the evidence now shows two failure classes
> where this paragraph names one. What has actually been observed, with its size:
>
> - **Surnames.** One phone test, five spoken, four transcribed clean, one rendered
>   severely wrong (`Swali` → `Swelha`; ADR-0006 records it). The owner's own dictation on
>   hardware has come through clean twice since. So the shape is *rare and severe*, not
>   constant and mild. That strengthens the case for ADR-0006's structural rule rather than
>   weakening it: rare means the representative is not watching for it, and severe means
>   nothing approximate recovers it.
> - **Clinical and domain vocabulary.** The representative's dictation on 2026-09-08
>   rendered two domain terms as phonetically similar ordinary English words —
>   "ergonomics" became "economics" — producing plausible sentences that read as real and
>   would survive a quick proofread in a car park. This is a different problem from the
>   mangled name. It is data quality, not privacy: the tokenizer has no reason to touch it
>   and must not, but it reaches the model as fact. `fieldnote-dx0` carries it, including
>   whether plan §4.2 already answers it by construction — on what is written, it does not,
>   because a note's own words are relational text under §4.2 and pass freely.
>
> Neither class has a rate. The sample is one representative, one session, and it should
> be cited that way.

**Done when:** capture works after a hard reload with the network disabled — not merely
with the network toggled off on an already-loaded page, which passes without a service
worker and proves nothing.

### Session 4 — The privacy boundary
*~2–3 hours*

`src/lib/privacy/pseudonymize.ts`. Stable tokenization of names, rehydration, and a
guard that throws if an untokenized string reaches the API client. Unit tests including
the nasty cases: names appearing inside note prose, possessives, initials, a surgeon
who shares a surname with a staff member.

**Add the dictation cases.** A tokenizer that only matches clean spellings will leak on
dictated input: phoneticized surnames, names split across words, names the OS heard as
common nouns. Write these from the real dictated notes (plan §7 item 2) rather than
inventing them — invented dictation artifacts are always too tidy.

Build this *before* the generation route. If generation exists first you will be
tempted to wire it up directly and retrofit the boundary, and retrofitted boundaries
leak.

**Done when:** a test asserting no raw name can reach the API client passes, and fails
if you remove the guard.

### Session 5 — Generation route, guardrails, and headers
*~3.5 hours*

Server-side route handler. Prompt templates and guardrail rulesets as versioned
modules. Per-person batching with accumulated openings. The retry and truncation
handling from the prototype fix.

> **Amended 2026-09-09, session 5.** Three corrections from the owner, made when the
> session's verification pass found premises this entry rested on that the repository
> could not support.
>
> **There was no prototype retry-and-truncation fix to port.** The prototype's drafts came
> back cut off because `max_tokens` was set artificially low for a test, and the fix was
> raising the number: a configuration correction with no logic in it. The handling was
> built fresh — SDK retries with the count in one constant, one retry at a doubled ceiling
> on truncation, and a block on a second truncation or a refusal — and lives in
> `src/lib/generation/model.ts` and the route. Nobody should chase the prototype fix
> again.
>
> **Accumulated openings, defined.** One request per attendee carrying that person's
> notes; each finished draft's opening line is carried into the next request so a batch
> does not open every email the same way. One pseudonymizer instance per batch keeps the
> tokens stable across it.
>
> **The audit-record agreement is suspended in this session.** `CLAUDE.md` says every
> model interaction writes an audit record and there are no silent generations; this
> guide puts the records in session 6. The two cannot both hold here, and the resolution
> is that session 5 generates without audit records **and does not persist drafts** —
> they are held in memory. Not persisting is the point: a `DraftRecord` in Dexie with no
> `AuditRecord` beside it is the shape the agreement forbids. Session 6 owes both, in one
> change, and its entry says so. The generation UI built here — one button and a
> read-only list — is the pipeline's proof, is marked throwaway, and is deleted by
> session 6.

**Plus CSP, SRI, and strict security headers** (plan §5, non-negotiable 4). This is the
first session in which a server-side response exists, so it's the natural home. About 45
minutes of the estimate. Assert them in a test against a live response rather than
leaving a config file nobody reads again — in this repository a control that isn't tested
isn't a control.

**Plus a single-egress check in CI** (plan §4.1, ADR-0005). The claim that this system
has exactly one network destination — the model API route — is the strongest property in
the repository, and it currently lives only in prose. Make it a test that fails the
build when a second destination appears.

Start crude. A grep over `src/` for `fetch(`, `XMLHttpRequest`, `new WebSocket`,
`navigator.sendBeacon`, `EventSource`, and `import(` with a remote specifier, with the
model route as the single allowed destination, is enough. The value is not in the
sophistication of the check; it is that adding a transcription service, an analytics
SDK, or a CDN font in month four fails CI instead of passing unnoticed. Budget about 30
minutes, and expect the allowlist to be the fiddly part.

Tighten it as the codebase grows. A grep is easy to evade once there is indirection —
a URL assembled from parts, a fetch behind a wrapper, a dependency that phones home from
inside `node_modules` where this check never looks. The honest framing is that this
catches the careless case, not the determined one, and the check should be described that
way wherever it is cited rather than as proof of the property. Revisit it in session 15
when the threat model is written, and consider whether a CSP `connect-src` assertion
against a live response covers more ground than the grep does.

**Plus an adversarial case for every guardrail written here.**

> **Amended 2026-09-02.** `CLAUDE.md` requires the eval case before the guardrail — "a
> guardrail with no adversarial test is unverified" — while this guide put guardrails in
> session 5 and the eval suite in session 7. As written those cannot both hold. Resolved:
> `CLAUDE.md` wins on principle, this guide wins on sequencing. **Session 5 writes the
> adversarial cases alongside each guardrail it builds, so nothing ships unverified.**
> Session 7 builds the runner and the CI integration that execute them at scale, and adds
> the rest of the corpus. See the matching note on session 7.

> **Amended 2026-09-09, session 5.** How that was done: `scripts/evals.mjs` is a
> placeholder that exits 0 against zero cases, so nothing in the repository could execute
> an eval case. Every guardrail written in session 5 therefore has its adversarial case
> as an ordinary Vitest test under `pnpm test` — `tests/unit/guardrails.test.ts`,
> `tests/unit/prompt.test.ts`, `tests/unit/generate-route.test.ts` — where the
> counterfactual is demonstrable now: remove the rule, watch the case pass through.
> What those tests cannot verify is the model's own behaviour under the prompt — whether
> it obeys an instruction embedded in a note, whether it adopts an attendee's claim as its
> own — and that is what session 7's runner is for. The cases are written in the shape it
> will consume.

**On claim-bearing text, which has no library yet.** Plan §4.2 and `CLAUDE.md` are absolute
that claim-bearing text is selected from the approved content library and never authored,
and that unmatched output is blocked rather than flagged. That library is session 9. The
consequence here is deliberate and should not be designed around: with nothing to match
against, **everything claim-bearing is unmatched, so session 5 blocks all of it.** Drafts
come back with gratitude and logistics and a gap where product language would go. That is
§4.2 working, observed early — not a defect, and not a reason to let the model author claims
until the library exists.

**Done when:** drafts generate end to end with names tokenized in the API payload and
correct in the UI, every guardrail written here has an adversarial case that fails when the
guardrail is weakened, claim-bearing output is blocked with the gap visible in the draft, a
CI test asserts the security headers on a real response, and a CI check fails when a network
destination other than the model route is introduced — verified by adding one temporarily
and watching the build go red.

### Session 6 — Audit log and review gate
*~2–3 hours*

Immutable audit records. Draft state machine with export gated on review. Edit-distance
capture between generated and exported text.

That edit-distance field is the quiet centerpiece — it's a measurable signal of whether
the human is actually reviewing. Surface it as a small dashboard.

**Done when:** every generation writes a record, export is impossible from `generated`
state, and the audit log exports to CSV.

> **Amended 2026-09-09, session 5.** This session owes three things the session 5
> amendment above deferred to it. **Draft persistence and the audit record land
> together**: session 5 held drafts in memory precisely so that no `DraftRecord` exists
> without an `AuditRecord` beside it, and this session adds both in one change, restoring
> `CLAUDE.md`'s no-silent-generations agreement. **The versions are ready**:
> `PROMPT_TEMPLATE_VERSION`, `GUARDRAIL_RULESET_VERSION`, `MODEL_ID`, and the rule ids in
> `flagsFired` are what the schema's fields already expect, and `DraftOutcome` in
> `src/lib/generation/pipeline.ts` carries all of them. **Delete the throwaway UI** —
> `src/components/capture/DraftList.tsx` and the button in `CaptureScreen` — and replace
> it with the review surface; the bead that records this is named in the session 5 PR.
> And before the review surface is designed, check `fieldnote-xjs`: gate 1b, an observed
> session with the representative, blocks anything that builds on the capture layout, and
> the review surface is the first thing that does.

> **Amended 2026-09-11, between sessions 5 and 6.** The gate 1b check above is met and
> no longer blocks. The representative was observed using the capture surface and
> confirmed the layout; the owner's note is on `fieldnote-xjs`, closed. The review surface
> can build on the capture layout as it stands. What it should read before it is designed
> is `fieldnote-g7d`, the pre-meeting briefing package she reached for and did not find,
> so that the path is designed against rather than rediscovered. One more item belongs to
> this session: `fieldnote-x9p`, an ADR recording that deleting an event spares its audit
> records. It has been open since session 2 as a source comment, and this is the session
> that builds the audit log.

> **Amended 2026-09-11, session 6, on completion.** What shipped, and two corrections to
> the notes above. **"The versions are ready" was true for what it named and silent on the
> rest**: `model`, the two versions, and `flagsFired` were on the audit schema and in
> `DraftOutcome`, but `inputHash`, `outputHash`, `editDistance`, and `humanEdited` had no
> producer, and the draft record carried neither flags nor a blocked reason. Schema v2
> adds `generatedBody` (write-once, so edit distance has a pre-image the audit record
> deliberately does not hold), `flagsFired`, and `blocked` to the draft, and the blocked
> reason, the two review-gate timestamps, and nullable hashes and human-edited fields to
> the audit record. **The pipeline computes both hashes**, because it is the only place the
> pre-images exist: the request as sent, and the guarded text before rehydration
> (ADR-0008 says why). **"Immutable" is defined**: written once with its draft in the same
> transaction, never deleted, touched exactly twice by the two transitions. **Opened means
> opened**: tapping a draft into the detail view is the act that marks it reviewed; the
> list cannot export. **The dashboard is deferred** by the owner's decision; the number is
> captured and shown plainly with its caveat, and `fieldnote-5iv` records what a dashboard
> would need. **Blocked drafts persist** as a fourth state with no outgoing transition,
> and the test walks the graph. **The over-blocking instrument** is flags and distance per
> draft, side by side across the event and in the CSV, with no score and no threshold;
> `fieldnote-ay2` records that the rate is unmeasured. The throwaway UI is gone
> (`fieldnote-aev` closed) and ADR-0008 is written (`fieldnote-x9p` closed).

### Session 7 — Eval suite
*~4 hours, and this one runs long*

The adversarial corpus from plan §4.5, the runner, and CI integration with a pass
threshold.

> **Amended 2026-09-02.** Session 5 now writes an adversarial case alongside each guardrail
> it builds, so this session inherits cases rather than starting from none. What lands here
> is the **runner, the CI integration, and the rest of the corpus** — the classes session 5
> had no guardrail for, and the breadth plan §4.5 describes. The reason for the split is
> that `CLAUDE.md` forbids shipping a guardrail without a test, so the cases cannot all wait
> until this session; the runner can.

> **Amended 2026-09-09, session 5.** The cases session 5 wrote are Vitest tests under
> `pnpm test`, not entries in a corpus, because there was no runner to execute a corpus.
> This session ports them: the inputs in `tests/unit/guardrails.test.ts` are what a model
> would write if the prompt failed, and the runner's job is to find out whether it does.
> Two things only the runner can verify are already named there — prompt injection inside
> a note delimiter, and an attendee's claim adopted as the sender's — and the ruleset's
> claim-bearing classifier is a heuristic whose false-negative rate is unmeasured until
> this session measures it.

> **Amended 2026-09-11, session 6.** Session 6's adversarial cases are not corpus cases and
> this session does not port them. They assert invariants of the data-access layer and the
> state machine — no draft without its record, export impossible from `generated`, nothing
> out of `blocked`, the cascade sparing audit records — in `tests/unit/repository-drafts.test.ts`
> and `tests/unit/draft-state.test.ts`, and they stay there. What this session inherits from
> session 6 is the other direction of the measurement: `fieldnote-ay2` records that the
> false-positive rate has an instrument (flags and edit distance per draft) and no
> measurement, beside the false-negative rate this session's runner measures.

> **Amended 2026-09-11, session 7, on completion.** Three corrections to the notes above,
> and what shipped. **"Ports" overstated it.** The fifteen sentences in the six rule blocks
> of `guardrails.test.ts` are outputs — what a model writes if the prompt fails. A corpus
> is notes that provoke those outputs, and is a new artifact; the fifteen serve as
> expected-violation oracles, and the deterministic gate test uses them as such.
> **"The classes session 5 had no guardrail for" was stale**: every class in plan §4.5
> had a rule except the two that are model behaviours, prompt injection inside a note and
> the attendee's claim adopted as the sender's; those two plus breadth were the corpus
> gap. **The prompt template was 1.1.0**, so the model no longer writes the greeting and
> no oracle may expect one. **What shipped**: a corpus of twelve cases across the seven
> classes, built from the public fixtures' dictation artifacts and never from `private/`,
> each with its own narrow detector separate from the ruleset; a runner that sends each
> case through the real pipeline with the shared model call (`model-call.ts`, extracted
> from the route so the two cannot drift) and records prompt-level and combined results
> per class; a gate at 100% on the combined result; a deterministic counterfactual in
> `Verify` that a removed rule lets a violation through, plus one live; a diff-gated
> entry that skips with a log line on an unrelated PR; and the first `README.md` with
> the results of one run. **What the first run measured**: across five runs the model
> produced, by the final detectors, a sender-voice violation on one sample in twelve, and
> nothing reached a draft; the runs found four detector defects and no guardrail gap, and
> the ruleset's over-blocking on relational sentences is now observable per run
> (`fieldnote-ay2`). One call per case, so a sample and not a rate.

> **Amended 2026-09-14, between sessions 7 and 8.** The detectors were frozen at #39, so
> every run since is held out. **The first held-out run, under ruleset 1.1.0 at five
> samples per case, found a guardrail gap**: on 1 of 60 samples the model wrote "On the
> question of use outside the cleared population:" in its own voice, the indication
> rule's regex knew "cleared for" and not "cleared population", and the sentence reached
> the draft. Ruleset 1.2.0 adds a phrase list, not a bare "cleared" (`fieldnote-2rh`,
> closed). **The held-out run under 1.2.0**: 0 of 60 reached, 2 of 60 produced, both
> caught. **The live counterfactual against the final detectors passed**: with
> claim-bearing removed, four claim cases at three samples each produced nothing the
> detectors count, because the model echoes rather than adopts. So the live suite cannot
> demonstrate the claim-bearing rule's necessity; only the deterministic gate test in
> `Verify` can, and the previous note's "plus one live" is withdrawn — that run predated
> the last detector change. Three live runs, $1.49.

Budget more time than feels right. Writing assertions that catch a real violation
without firing on acceptable output is genuinely fiddly, and you'll rewrite several
cases once you see what the model actually does. This is also the session that produces
the most interesting material for the README.

The prompt-injection cases should be built on the real dictated notes, with the
injection payload inserted into genuine dictation artifacts. An injection wrapped in
clean prose tests a condition that will never occur.

**Done when:** the suite runs in CI, a deliberately weakened guardrail fails the build,
and pass rates are published in the README.

### Session 8 — Roster import
*~2 hours*

`read-excel-file`, client-side, per ADR-0003 — not SheetJS. Column mapping UI, because
sign-in sheets never have consistent headers. Fuzzy match against captured names.

Note that CSV is a separate entry point in this library rather than unified with Excel
parsing. And per ADR-0003's residual-risk section: treat parsed output as hostile —
validate and normalise every field before it reaches Dexie, and never pass parsed
content into a model call without routing it through the session 4 boundary.

**Done when:** a messy real-shaped `.xlsx` imports correctly and the file never touches
the network.

> **Amended 2026-09-14, session 8, on completion.** One premise here was wrong: CSV is
> not a separate entry point in `read-excel-file` — the library has no CSV support at
> 9.3.10 — so CSV is read by a forty-line reader in `src/lib/roster/csv.ts`, and
> ADR-0003 carries the note. What shipped: format by magic bytes with `.xls` refused and
> an instruction to re-save; every cell sanitised before anything sees it; a header found
> under banners and blank rows, with a merged cell's sub-labels joined to it; mapping
> guesses by header text, with a title column prepended to the name so the greeting keeps
> its title; a matcher that compares canonical names — exact, then surname, then one edit
> on a surname of five or more letters — and proposes, never merges, missing Swali/Swelha
> by design; an import screen from the event switcher, beside "Start a new event…", so
> the validated header is unchanged and the dock's add-person flow is untouched; schema v3
> with `Attendee.source`; and an end-to-end spec that records every request during an
> import and finds none left the origin. "A messy real-shaped `.xlsx`" means
> `tests/fixtures/roster-messy.xlsx`, built by `scripts/build-roster-fixture.mjs`, whose
> header names each artifact. Two findings from the run: `read-excel-file` drops trailing
> empty columns before any code sees them, and the matcher's first version let a surname
> match on an earlier row take a person whose own row matched exactly, fixed the same day.
: ~22 hours, seven to eight evenings.**

---

## Phase 2 — Internal briefing

### Session 9 — Approved content library
*~2–3 hours*

Storage, upload, and the matcher that validates claim-bearing output against it.

Blocked on knowing what approved content actually exists (plan §7 item 4) — it decides
whether this is a library-selection feature or a paste field.

> **Amended 2026-09-14.** Unblocked: plan §7 item 4 was received that day and lives at
> `private/approved-content-brochure.md`. What it is and what it decides are recorded
> beside the material, per the working agreement in `CLAUDE.md` on findings about the
> private material; the public record says only that it exists. The session that builds
> this reads the private file first, and nothing from it reaches a public fixture or
> eval case without every name and every product and commercial detail substituted
> (plan §7 as amended).

> **Amended 2026-09-14, session 9, on completion.** The material decided it: a
> library-selection feature, small. "Upload" above is not what shipped — passages are
> entered one at a time, label, body, and the approving document's code and version, and
> there is no bulk upload by decision. What shipped: the matcher in
> `src/lib/generation/approved.ts` — exact, whole passage, after whitespace and
> quote-and-dash normalisation with case kept, nothing looser — which holds approved
> spans out of every rule with a placeholder and puts the library's own body back after;
> a library that refuses a passage at load when the pricing, hospitality, patient, or
> invented-name rule fires on it or the pseudonymizer's structural guard would; prompt
> template 1.2.0, which lists the passages after the notes and tells the model to select
> and copy exactly, and keeps the empty-library wording word for word; ruleset 1.3.0,
> the exemption and "rather than" no longer read as a comparison; schema v5, the audit
> record carrying `passagesUsed` and `libraryVersion` (ADR-0008 amended); the library
> screen from the event switcher; five invented passages as fixtures; and two eval
> classes, passage-verbatim and passage-paraphrase, with the held-out figures in
> `README.md`. The public build ships with the library empty. What the private material
> is and what it decided are recorded beside it, per `CLAUDE.md`. Also folded in:
> `fieldnote-frx`, the dock classifying a typed Dr or Prof as a clinician.

### Session 10 — Attendee profiles
*~2 hours*

Photo upload (uploaded, never fetched), prior-interaction history, suggested openers.

> **Amended 2026-09-14, session 10, under ADR-0009.** Of the three nouns above, one is
> withdrawn and one moves. **Suggested openers are withdrawn**, not deferred: the model
> writes no part of the briefing, and the representative writes the opener herself.
> **Photo upload moves to session 11**, with the document it exists for; it needs binary
> storage the cipher does not have, and that is a schema decision for the session that
> lays the document out. **Prior-interaction history** already exists as data keyed by
> the attendee, and this session renders it. What this session builds instead: the
> attendee view — one person's record, editable, with their notes and drafts across every
> event on the device and a line saying nothing is fetched — and the structured
> clinician field `fieldnote-1o6` asks for, `Attendee.kind`, replacing the heuristic
> that read the token class off `specialty`.

### Session 11 — Briefing PDF
*~4 hours, and this one also runs long*

PDF generation always takes longer than estimated. Layout that survives both a phone
screen and a printer is fiddly, and you'll iterate on it more than you plan to.

> **Amended 2026-09-14, under ADR-0009.** This session gains the form the representative
> fills — event details, logistics, contacts, and per attendee whatever she types or
> dictates — and the photo upload and its storage, a binary entity with the cipher
> extended for it. No model: the document is laid out from her entries and offered as a
> download; nothing is generated, so there is no prompt, no ruleset, and no audit record.
> The attendee section states that it is expected attendance as of the generation date.
> The schema and entity gaps `fieldnote-g7d` lists — event metadata the record does not
> hold, the representative's own team as a second class of person — land here. Deal
> positioning has no home in the public build.

> **Amended 2026-09-15, session 11, on completion.** What shipped, and what the four
> hours above did not know about. **ADR-0010** chose `pdf-lib` over `jspdf` and the
> print path, in ADR-0003's shape, with the advisory material for each; the deciding
> reason was the smaller thing to trust, and the stated cost is that the library is
> unmaintained. **The cipher learned a second shape**: bytes beside strings, a field's
> policy declaring which, a mismatch refused in both directions (ADR-0004 amended).
> **Schema v6**: five dossier fields on the event, briefing notes on the attendee, an
> `images` table of bytes with a sibling media type — never a `Blob` — and a `contacts`
> table for her own team, the site coordinator, the truck operator, which never enters a
> model call and is fenced off from the generation and privacy layers by a test.
> **Photos** are resized on the device to 512 pixels on the longest edge, JPEG, through
> a pure function over a drawing surface; the real surface decodes with
> `createImageBitmap` because the Content Security Policy allows no `blob:` image, and
> the thumbnail is a `data:` URL for the same reason. Upload lives on the attendee view
> beside the briefing notes. **The screen** is reached from the switcher, in the
> document's order, and Generate is a download through the same helper as the audit-log
> CSV; no record is written. **The document** is composed as a model and drawn on a page
> that fits both A4 and Letter, standard fonts with a mark for what they cannot encode,
> a two-line footer on every page stating the event, the generation time, and expected
> attendance. The fixture event renders to two pages and about nine kilobytes. A
> synthetic photo — a flat colour with invented initials — is committed with its
> generator, which also builds a twelve-megapixel image in memory for the end-to-end
> spec that pushes it through IndexedDB. **Not in it by decision:** the dictated notes,
> deal positioning, the site map (session 12), the post-event readout (its own bead).
> **Not yet true:** a real phone photo has not been through it, and the bitmap API's
> EXIF handling on the target phone is unobserved. The four hours became a dependency
> decision, a cipher extension, two entities, a form, and the document; the total below
> is revised.

**Phase 2 total: ~11 hours** (revised 2026-09-15: session 11 is nearer six than four —
the dependency ADR, the cipher's second shape, two entities and their migration, and
the screen were each real work the four-hour line did not include; 8.5 before).

---

## Phase 3 — Pre-event communication

### Session 12 — Email composer and logistics
*~3 hours*

Template, location block, universal map links for Apple and Google Maps, site map
upload.

> **Note, 2026-09-15, session 11.** The site map goes in the `images` table with
> `purpose: "site-map"`, owned by the event. (Corrected later the same day: session 12
> writes it, from the pre-event screen, at 1600 pixels as PNG; the note as first written
> said the resize was already there for it, and it was, at a photo's settings.)

> **Amended 2026-09-15, session 12, on completion.** Two questions the plan left open
> were settled by the owner and recorded as **ADR-0011**: a pre-event email is a draft
> under the review gate, model or not — one `DraftRecord` per recipient of kind
> `pre-event`, the same state machine, detail view, and clipboard export, an audit
> record with a null model and null template — because the gate exists for what leaves
> the device; and the ruleset runs over the whole email, her logistics included, because
> §4.2 is about what is claim-bearing and not who wrote it. What shipped: schema v7
> (`DraftRecord.kind`, the event's `address` and `coordinates` as one validated
> string, nullable audit fields); the composer in `src/lib/preevent/compose.ts` — subject,
> greeting from the record, her logistics, the location block with Apple Maps and Google
> Maps links built from the coordinates as text never fetched, "Site map attached." while
> one is stored, the selected passages verbatim, a sign-off — the body through
> `applyGuardrails` with the library held out; the screen from the switcher in that
> order; the review surface labelling the kind and explaining a gap without naming a
> model. **The site map decision:** it cannot ride the clipboard, so it downloads from the
> composer as a file for her to attach in Mail, and the briefing draws it in its Event
> section (plan §3.2). The resize took its settings as a parameter for it: 512 JPEG for a
> photo, 1600 PNG for a map. Also folded in from session 11's review: `CLAUDE.md`'s
> decision-record list completed, the attendee view's remove-with-confirmation, and the
> denylist allowing `example.com` so a contact fixture can carry an address. **Not in
> it:** the `.ics` (session 13, which now has a bead for the end time the schema lacks),
> the forwardable block (session 14; the composer has a place for it and nothing more).

### Session 13 — Calendar generation
*~2 hours*

`.ics` output. Straightforward, high value, and nobody does it.

> **Amended 2026-09-15, session 13, on completion.** Three parts, two of them carried in
> from session 12's review. **Ruleset 1.4.0**: a product noun followed by a verb of state
> or design is claim-bearing, and the noun list gains the parts the passage detector
> names, so the two instruments agree; found by the eval gate on PR #46, where a sample
> no rule caught was never seen. Held-out run the same day, 0 of 70 reached, and the
> README carries the table. **The eval artifact**: `evals.yml` keeps the results file for
> seven days on every live run, pass or fail. **The calendar file**: schema v8 gives the
> event an end time, entered with the start on the pre-event screen; the `.ics` is RFC
> 5545 by hand — one `VEVENT`, `UID` at the reserved `.invalid` suffix, both ends in UTC,
> summary, location, `GEO`, and a description holding the address and the two map links
> and nothing else, because logistics prose leaving the device without the ruleset is
> the thing ADR-0011 exists to stop; no `ATTENDEE`, no `ORGANIZER`. Downloaded from the
> composer beside the site map, disabled until the event has both ends; the email says a
> calendar invitation is attached when it does. Line-by-line unit test on the fixture, no
> parser. The denylist allows an identifier at a `.invalid` domain, with the reason.

### Session 14 — Invite feature
*~2 hours*

Design A per ADR-0002. Behind a flag, defaulted off, approved content only, no
tracking. The constraints make this smaller than it sounds.

> **Amended 2026-09-15, session 14, on completion.** It was smaller than it sounds.
> Schema v9 puts the flag on the event, false on creation and backfilled false, turned
> on per event from a switch on the pre-event screen that saves as it is toggled. The
> composer ends the email with the block when the flag is on: the event's name, when,
> where, the logistics, and the selected passages between four fixed strings — every
> line a field the email already carries, no input of its own, the same for every
> recipient, the two map links its only URLs, and through the ruleset with the rest.
> Each of ADR-0002's five constraints is a unit test, and the ADR is amended with where
> each is enforced. The attachment lines stay out of the block, because an attachment
> does not travel with it. No Guardian prompt existed for this session; the scope was
> taken from this entry, ADR-0002, and the handoff, and `docs/prompts/session-14.md`
> says so. Phase 3 closes.

**Phase 3 total: ~7 hours.**

---

## Phase 4 — Hardening

### Session 15 — Threat model
*~3 hours*

STRIDE, with prompt injection via dictated input as a first-class entry. Dictation is
an untrusted input channel and should be modeled as one (ADR-0005).

Three findings from Phase 0 belong in here as worked entries, and they are better
evidence than a clean scan: the sibling-file leak path in `.gitignore`, the same bug
class repeated in `.env*`, and required status checks silently depending on job display
names. Also state ADR-0004's accepted residual risk plainly — data at rest is protected
by full-disk encryption and origin isolation and nothing else.

> **Amended 2026-09-15, session 15, on completion.** `docs/THREAT-MODEL.md`: what is
> protected and from whom; four boundaries — the device, the browser origin, the one
> egress, and the repository with the tools that write to it — with a text diagram;
> STRIDE per boundary, every control naming the file that enforces it or saying it is
> documented only, and each empty cell saying why. Injection through dictated input is
> the first-class entry: the pseudonymizer removes names and not instructions, the
> ruleset judges sentences by rule id and not intent, an obeyed instruction that
> produces relational text reaches the draft and the review gate is what shows it, and
> dictation's own substitution of a clinical term is tampering by the channel. The
> three Phase 0 findings above became six worked entries, because the sessions since
> owed three more: installed tooling rewriting the repository's controls, three
> instances and one pattern; the beads publication of 2026-09-09, written under the
> `CLAUDE.md` agreement on the private material; and device auto-lock as a private-fork
> precondition beside ADR-0004. One control was built, because the finding was a
> failing test: `tests/unit/required-checks.test.ts` asserts the three rendered job
> names branch protection depends on, with the counterfactual run and `.github/`
> unchanged. Residual risk is one section for sessions 16 and 17 to cite. The eval gate
> skipped. The prompt was drafted by the session 14 instance and rewritten by Guardian;
> `docs/prompts/session-15.md` has it.

### Session 16 — Data protection assessment
*~3 hours*

Data inventory, flow diagrams, minimization rationale, retention. Your wheelhouse —
probably faster than my estimate.

Retention is not just a documentation item here: ADR-0004 leans on a small local store
as a mitigation, so retention has to be a real implemented behaviour. Decide it before
this session, not during it.

> **Amended 2026-09-16, session 16, on completion.** `docs/DATA-PROTECTION.md`: the four
> kinds of data subject; the inventory of all eleven tables from the schema, every field
> with its classification and the schema's own reason, nothing re-classified, and the
> classification read as ADR-0004's plan rather than as encryption in place; six flows
> in text — capture, roster import, generation with the request the route validates
> field by field, the five hand exports, deletion, and the platform's copies — each with
> what enters, what is stored, what leaves, and by whose action, and the platform's
> dictation and backup named as unverified; retention as the owner decided it
> (`fieldnote-tcq`, 2026-09-16, changed 2026-09-17) and as not yet built
> (`fieldnote-iox`), so the store is
> not bounded today and ADR-0004's reliance on a small store is a policy, not a property;
> minimisation as decisions with the file that enforces each; rights and their limits —
> the attendee-removal limit, the single-note limit, the audit-record exception, and what
> the cascade test does and does not prove; the one processor and what is not verified
> about it; residual risk citing the threat model's §6 by item and adding bead-backed
> items only. No legal characterisation anywhere: that is session 17's. The session
> stopped once, on a premise the tracker carried wrongly, and resumed on the owner's
> correction; `docs/prompts/session-16.md` has both. No code changed and the eval gate
> skipped. The prompt was drafted by the session 15 instance and rewritten by Guardian.

### Session 17 — Compliance map
*~3 hours*

Controls mapped to NIST AI RMF, EU AI Act, ISO/IEC 42001. Be precise about the risk
tier rather than expansive; accuracy reads better than overclaiming.

The same precision applies to controls not built. Map ADR-0004's seam as what it is,
and cite the ADR, rather than mapping encryption-at-rest as implemented.

### Session 18 — README, system card, demo
*~3 hours*

Published eval results, known failure modes, a short screen recording.

**Phase 4 total: ~12 hours.**

---

## Private fork — off the public critical path

### Session 19 — Encryption at rest
*~3 hours*

WebCrypto envelope encryption implemented over the seam built in session 2, in the
private fork only. Per ADR-0004, this does not ship without a stated key-recovery story
— a passphrase with no recovery path is a second way to lose an afternoon's capture,
which is the failure this project exists to fix.

Numbered at the end deliberately rather than inserted into Phase 2: renumbering sessions
9–18 would invalidate every cross-reference in the plan, the guide, and the handoff, for
no benefit.

**Done when:** records round-trip encrypted, the passphrase has a recovery path, and a
migration moves an existing plaintext store forward without loss.

---

## Totals

Hours are midpoints where a session is given as a range.

| Phase | Hours | Evenings |
|---|---|---|
| 0 — Foundation | 2 | 1 |
| 1 — Core | 22 | 7–8 |
| 2 — Briefing | 11 | 4 |
| 3 — Pre-event | 7 | 2–3 |
| 4 — Hardening | 12 | 4 |
| **Public total** | **~54** | **18–20** |
| 19 — Encryption (private fork) | 3 | 1 |

At three evenings a week: **six to seven weeks.** At two: nine to ten.

Phase 0 plus Phase 1 is roughly three weeks and is the point at which you have
something worth showing. Everything after is depth.

## Where estimates go wrong

Three sessions reliably run over: the eval suite (7), the PDF (11), and the threat
model (15). Everything else tends to land close.

The variable nobody estimates well is prompt iteration. You will spend more time
adjusting the voice profile and guardrails against real output than any single session
above. Budget it as ongoing rather than as a session — an hour here and there across
the whole build.

One more, specific to this build: the voice profile currently derives from a single
broadcast email with no personalization in it, so it teaches register and nothing about
how she personalizes. Session 5's output quality is capped until the samples in plan §7
land, and no amount of prompt work raises that ceiling.
