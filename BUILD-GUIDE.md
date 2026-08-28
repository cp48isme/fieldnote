# Build Guide

Session-by-session build order. Each session is one sitting of two to four hours with
a single goal, a definition of done, and a commit. Stop at the end of a session even if
you have momentum — the commit boundaries are what make the history readable, and the
history is part of the artifact.

Estimates assume you're working with Claude Code and already know Next.js. They are
generous where I've seen things reliably take longer than people expect, and I've
flagged which those are.

---

## Phase 0 — Foundation

### Session 1 — Scaffold and governance skeleton
*~2 hours*

Repo, Next.js scaffold, CI, security settings, empty doc tree, both ADRs, CLAUDE.md.
Nothing works yet. That's correct.

Wire `evals.yml` now with a single trivially passing case so the badge exists from the
first commit and every later guardrail change has to clear it.

**Done when:** `main` is protected, CI is green, both badges render in the README, and
the ADRs are committed.

**Commits:** `chore: scaffold`, `docs: ADR-0001`, `docs: ADR-0002`, `chore: CI and
security baseline`

---

## Phase 1 — Core, built properly

This is the phase that matters. Everything after it is additive. If you shipped only
Phase 1 it would still be a defensible portfolio piece.

### Session 2 — Data layer and persistence
*~3 hours*

Dexie schema for `Event`, `Attendee`, `Note`, `Draft`, `AuditRecord`, `VoiceProfile`,
`ApprovedContent`, `Settings`. Migration scaffolding and schema versioning. Debounced
autosave. Crash recovery on load.

This directly fixes the failure observed in prototype testing. Build recovery first and
the rest of the app inherits it.

**Done when:** you can create an event, close the tab mid-typing, reopen, and find
everything including the half-finished note.

### Session 3 — Capture UI
*~3 hours*

Port the prototype's capture dock and log. It's already validated — don't redesign it,
just rebuild it on the real data layer with proper components and types.

**Done when:** capture works offline with the network disabled in devtools.

### Session 4 — The privacy boundary
*~2–3 hours*

`src/lib/privacy/pseudonymize.ts`. Stable tokenization of names, rehydration, and a
guard that throws if an untokenized string reaches the API client. Unit tests including
the nasty cases: names appearing inside note prose, possessives, initials, a surgeon
who shares a surname with a staff member.

Build this *before* the generation route. If generation exists first you will be
tempted to wire it up directly and retrofit the boundary, and retrofitted boundaries
leak.

**Done when:** a test asserting no raw name can reach the API client passes, and fails
if you remove the guard.

### Session 5 — Generation route and guardrails
*~3 hours*

Server-side route handler. Prompt templates and guardrail rulesets as versioned
modules. Per-person batching with accumulated openings. The retry and truncation
handling from the prototype fix.

**Done when:** drafts generate end to end with names tokenized in the API payload and
correct in the UI.

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

**Done when:** the suite runs in CI, a deliberately weakened guardrail fails the build,
and pass rates are published in the README.

### Session 8 — Roster import
*~2 hours*

read-excel-file, client-side. Column mapping UI, because sign-in sheets never have
consistent headers. Fuzzy match against captured names.

**Done when:** a messy real-shaped `.xlsx` imports correctly and the file never touches
the network.

**Phase 1 total: ~20 hours, six to eight evenings.**

---

## Phase 2 — Internal briefing

### Session 9 — Approved content library
*~2–3 hours*

Storage, upload, and the matcher that validates claim-bearing output against it.

### Session 10 — Attendee profiles
*~2 hours*

Photo upload (uploaded, never fetched), prior-interaction history, suggested openers.

### Session 11 — Briefing PDF
*~4 hours, and this one also runs long*

PDF generation always takes longer than estimated. Layout that survives both a phone
screen and a printer is fiddly, and you'll iterate on it more than you plan to.

**Phase 2 total: ~9 hours.**

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
an untrusted input channel and should be modeled as one.

### Session 16 — Data protection assessment
*~3 hours*

Data inventory, flow diagrams, minimization rationale, retention. Your wheelhouse —
probably faster than my estimate.

### Session 17 — Compliance map
*~3 hours*

Controls mapped to NIST AI RMF, EU AI Act, ISO/IEC 42001. Be precise about the risk
tier rather than expansive; accuracy reads better than overclaiming.

### Session 18 — README, system card, demo
*~3 hours*

Published eval results, known failure modes, a short screen recording.

**Phase 4 total: ~12 hours.**

---

## Totals

| Phase | Hours | Evenings |
|---|---|---|
| 0 — Foundation | 2 | 1 |
| 1 — Core | 20 | 6–8 |
| 2 — Briefing | 9 | 3 |
| 3 — Pre-event | 7 | 2–3 |
| 4 — Hardening | 12 | 4 |
| **Total** | **~50** | **16–19** |

At three evenings a week: **five to seven weeks.** At two: eight to ten.

Phase 0 plus Phase 1 is roughly three weeks and is the point at which you have
something worth showing. Everything after is depth.

## Where estimates go wrong

Three sessions reliably run over: the eval suite (7), the PDF (11), and the threat
model (15). Everything else tends to land close.

The variable nobody estimates well is prompt iteration. You will spend more time
adjusting the voice profile and guardrails against real output than any single session
above. Budget it as ongoing rather than as a session — an hour here and there across
the whole build.
