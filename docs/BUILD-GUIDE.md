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

**Plus the service worker and PWA manifest** (plan §5, non-negotiable 5). It had no
session and capture is the first thing that has to survive a dead signal, so it lands
here. Budget about an hour of the four for it.

Capture is also where dictated text arrives. Per ADR-0005 the app records no audio and
knows nothing about dictation — but the textarea has to be comfortable to *correct* text
in, one-handed, standing up, because OS dictation will mangle surnames and punctuation
and there is no source recording to fall back on.

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

**Done when:** drafts generate end to end with names tokenized in the API payload and
correct in the UI, a CI test asserts the security headers on a real response, and a CI
check fails when a network destination other than the model route is introduced —
verified by adding one temporarily and watching the build go red.

### Session 6 — Audit log and review gate
*~2–3 hours*

Immutable audit records. Draft state machine with export gated on review. Edit-distance
capture between generated and exported text.

That edit-distance field is the quiet centerpiece — it's a measurable signal of whether
the human is actually reviewing. Surface it as a small dashboard.

**Done when:** every generation writes a record, export is impossible from `generated`
state, and the audit log exports to CSV.

### Session 7 — Eval suite
*~4 hours, and this one runs long*

The adversarial corpus from plan §4.5, the runner, and CI integration with a pass
threshold.

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

**Phase 1 total: ~22 hours, seven to eight evenings.**

---

## Phase 2 — Internal briefing

### Session 9 — Approved content library
*~2–3 hours*

Storage, upload, and the matcher that validates claim-bearing output against it.

Blocked on knowing what approved content actually exists (plan §7 item 4) — it decides
whether this is a library-selection feature or a paste field.

### Session 10 — Attendee profiles
*~2 hours*

Photo upload (uploaded, never fetched), prior-interaction history, suggested openers.

### Session 11 — Briefing PDF
*~4 hours, and this one also runs long*

PDF generation always takes longer than estimated. Layout that survives both a phone
screen and a printer is fiddly, and you'll iterate on it more than you plan to.

**Phase 2 total: ~8.5 hours** (8–9; midpoint, as with Phase 1).

---

## Phase 3 — Pre-event communication

### Session 12 — Email composer and logistics
*~3 hours*

Template, location block, universal map links for Apple and Google Maps, site map
upload.

### Session 13 — Calendar generation
*~2 hours*

`.ics` output. Straightforward, high value, and nobody does it.

### Session 14 — Invite feature
*~2 hours*

Design A per ADR-0002. Behind a flag, defaulted off, approved content only, no
tracking. The constraints make this smaller than it sounds.

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

### Session 16 — Data protection assessment
*~3 hours*

Data inventory, flow diagrams, minimization rationale, retention. Your wheelhouse —
probably faster than my estimate.

Retention is not just a documentation item here: ADR-0004 leans on a small local store
as a mitigation, so retention has to be a real implemented behaviour. Decide it before
this session, not during it.

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
| 2 — Briefing | 8.5 | 3 |
| 3 — Pre-event | 7 | 2–3 |
| 4 — Hardening | 12 | 4 |
| **Public total** | **~51.5** | **17–19** |
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
