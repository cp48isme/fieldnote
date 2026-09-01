# CLAUDE.md

Project instructions for Claude Code working in this repository.

## What this is

A local-first PWA for field representatives running demonstration events for regulated
products. It captures attendee interactions in the field and drafts personalized
follow-up correspondence for human review.

It is also a public reference implementation of AI governance practice. The compliance
architecture is load-bearing, not decorative. Treat governance controls as production
code with the same standards as any feature.

Read `docs/PROJECT-PLAN.md` before substantive work. Read the relevant ADR in
`docs/adr/` before touching anything it governs.

## Non-negotiable constraints

These are not preferences. A change that violates one is wrong regardless of how well
it is implemented, and should be rejected rather than improved.

**No real personal data, anywhere, ever.** No real name of a physician, staff member,
institution, or manufacturer appears in source, fixtures, tests, comments, commit
messages, or documentation. All example data is synthetic and obviously so. If you need
a name, invent one. See ADR-0001.

**No branding in source.** Manufacturer and product names are runtime configuration
loaded from user-supplied config, never hardcoded, never in fixtures. See ADR-0001.

**Names do not cross the AI boundary.** All attendee and staff names are replaced with
stable tokens client-side before any model API call, and rehydrated locally after. Any
new code path that sends content to a model must route through
`src/lib/privacy/pseudonymize.ts`. There are no exceptions for convenience, debugging,
or "just this one field."

**Claim-bearing text is selected, never authored.** Text describing product
characteristics, indications, or performance may only be assembled from the approved
content library. Unmatched claim-bearing output is blocked, not flagged. Relational
text — gratitude, logistics, references to what an attendee said — is generated freely
under the guardrails. When in doubt about which class a string belongs to, treat it as
claim-bearing.

**The system never sends anything.** Export is clipboard-only, into the user's own mail
client. Do not add SMTP, mail APIs, or scheduled sending. This keeps the tool out of a
different regulatory class entirely.

**No content leaves the device except the pseudonymized model call.** No analytics, no
telemetry, no error reporting service, no CDN-hosted fonts that leak referrers, no
third-party scripts. The API route logs metadata only — never note or draft content.

**Human review is a state, not a suggestion.** Drafts move `generated` → `reviewed` →
`exported`. Export is disabled until a human has opened the draft. Do not add a
"generate and export all" path.

**Guardrails and prompts are versioned.** Any change to a prompt template or guardrail
ruleset increments its version and is recorded in the audit schema. The eval suite must
pass before merge.

## Working agreements

- TypeScript strict. No `any` without an adjacent comment explaining why.
- Every model interaction writes an audit record. No silent generations.
- Persistence is local-first via Dexie. Do not introduce a server-side database of
  attendee data without a new ADR superseding ADR-0001.
- Write the eval case before the guardrail. A guardrail with no adversarial test is
  unverified.
- Schema changes require a migration and a version bump.
- If a task requires violating a constraint above, stop and say so rather than finding
  a way around it. The constraint is the point.

## Testing

- `pnpm test` — unit
- `pnpm test:e2e` — Playwright
- `pnpm evals` — adversarial guardrail suite against live prompts

The eval suite costs real API spend. Run it before pushing, not on every save.

## Decision records

Substantive architectural or governance choices get an ADR in `docs/adr/`, numbered
sequentially, following the existing format. Record rejected alternatives and their
reasoning — the rejections are as much a part of the artifact as the decisions.

Existing (index and conventions in `docs/adr/README.md`):
- ADR-0001 — de-branded public build, private fork for production use
- ADR-0002 — attendee invitation limited to recipient-forwarded messages
- ADR-0003 — `read-excel-file` for spreadsheet parsing, replacing `xlsx` (SheetJS)
- ADR-0004 — encryption seam in the data layer; passphrase-derived encryption deferred
  to the private fork
- ADR-0005 — device dictation only; no audio capture, storage, or transcription
