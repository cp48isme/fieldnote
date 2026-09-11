# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Between sessions 6 and 7

- The greeting is composed on the device from the attendee record as entered, title
  included, and prepended to the draft in place of anything the model wrote; the model
  is told not to write one (prompt template 1.1.0). Every draft had opened with a bare
  surname, because the model addressed a token and rehydration carries no title, and
  with edit distance now measured the first edit on every draft would have been the same
  one.

### Session 6 — audit log and review gate

- Drafts persist beside their audit records in one transaction, through the only write
  path there is; session 5's suspension of the no-silent-generations agreement is over.
  Schema v2: the draft carries its generated text, its guardrail flags, and a blocked
  reason; the audit record carries the blocked reason, the reviewed and exported
  timestamps, and nullable hashes and human-edited fields.
- The draft state machine as one table, `generated` → `reviewed` → `exported`, with
  `blocked` as a fourth state that has no outgoing transition. Export is refused from
  `generated`; a blocked draft cannot reach `exported` by any route; the test walks the
  graph.
- The pipeline computes the audit hashes over the request as sent and the guarded text
  before rehydration, so neither reconstructs only against a name (ADR-0008).
- The review surface, a second view on the validated capture layout: the list shows
  state, flags, and edit distance together per draft; opening a draft marks it reviewed;
  the detail view explains every flag and the gap marker, edits, copies to the clipboard
  and only then records the export with the character edit distance and its caveat. The
  throwaway draft list is gone.
- The audit log downloads as CSV, ids and hashes only, with an `eventStatus` column that
  marks records whose event has been deleted.
- ADR-0008: audit records survive event deletion, and what a record must therefore carry.
- An end-to-end spec that intercepts the one network call with a canned draft and walks
  persistence, the gate, the clipboard, the distance, and the CSV in a real browser.

### Between sessions 5 and 6

- `next` 16.3.4 and the minor-and-patch group, clearing four critical and one high
  Dependabot alert, with the headers spec loosened to match an uncovered script by its
  `src` alone (#36).
- The build guide's session 6 entry and the handoff template corrected: gate 1b is met,
  and beads are not private by description (#33).

### Session 5 — generation route, guardrails, and headers

- Role references at the pseudonymization boundary (ADR-0007): a role on the roster
  shares the rostered person's token, an unrecognised role is tokenized fail-closed,
  plurals and indefinite references pass through, and rehydration is per occurrence.
- A server-side generation route calling `claude-opus-5`: stateless, validated, retried
  on transient failure, blocked on a second truncation or a refusal, metadata-only
  logging. The key stays on the server.
- A versioned prompt template and a versioned guardrail ruleset (1.1.0). Claim-bearing
  text is blocked and replaced with a visible gap, because the approved content library
  does not exist yet. Site- and product-specific terms load at runtime from a gitignored
  file and are never committed.
- Per-person batching with accumulated openings, on one pseudonymizer instance per batch.
  Drafts are held in memory only; persistence and audit records land with session 6.
- Content Security Policy with a per-request nonce and `connect-src 'self'`, Subresource
  Integrity, and strict static headers, asserted against a live response.
- A single-egress check over `src/` that fails the build when a second network
  destination appears, and the end-to-end suite added to CI's `Verify` job.
- A throwaway generation button and draft list, deleted by session 6.

### Between sessions 4 and 5 — the first device run

- Data-layer failures reach a visible terminal state instead of an indefinite
  "Loading…": a session-marker failure degrades to capture without crash recovery, a
  failing read or write replaces the screen with what failed and what to do, and an
  insecure origin is refused up front rather than run without a service worker (#20).
- `pnpm serve:https` serves a production build over HTTPS on the LAN address for device
  testing, with no plain-HTTP listener beside it (#21).
- The device HTTPS setup generates a small local certificate authority and a server
  certificate signed by it, because iOS will not trust a self-signed leaf; the runbook
  `docs/TESTING-ON-DEVICE.md` records the walk on a physical iPhone (#28).

### Session 4 — the privacy boundary

- `src/lib/privacy/`: roster matching with stable tokens, possessives, initials, and
  shared surnames; structural name detection, so a token after a title is a name whether
  or not the roster knows it; and a guard on the API client that re-derives what a name
  looks like and throws with lengths, never text. ADR-0006 records the decision and the
  deliberate asymmetry toward over-tokenizing.
- Dictation fixtures with per-case provenance: observed, adapted from the private corpus
  with names and product detail substituted, or constructed.

### Session 3 — capture surface and offline shell

- The capture dock and log on the session 2 data layer: a fixed-height textarea built for
  correcting dictated text one-handed, attribution from the dock, a newest-first log, and
  a dismissible recovery notice. Built from plan §3.1 rather than ported from the
  prototype, which was not retrieved.
- A PWA manifest and a hand-written service worker with a precache manifest generated
  after the build, so capture survives a hard reload with no network.
- A gitignored `private/` path for pre-de-branding material.

### Session 2 — data layer and persistence

- A Dexie schema for the eight entities in plan §5 plus an internal session-marker table,
  with `createdAt`, `updatedAt`, and a schema version on every record and migration
  scaffolding from version 1.
- A single data-access layer under `src/lib/db/`, the only place Dexie is imported, with
  `encrypt`/`decrypt` hooks as identity pass-throughs and every field classified
  encryption-eligible or clear, enforced by the type system.
- Debounced autosave and explicit crash recovery with a recovered-session state.

---

Phase 0 — foundation. Scaffolding and governance skeleton. No feature code yet; the
application does nothing beyond serving the default page.

### Added

- Next.js 16 scaffold: App Router, `src/` layout, TypeScript in strict mode,
  Tailwind v4, ESLint 9 flat config, pnpm.
- Test tooling: Vitest on a jsdom environment, Playwright for end-to-end, each with a
  placeholder spec proving the harness runs.
- Runtime dependencies for the phases ahead: Dexie and `dexie-react-hooks` for
  local-first persistence, read-excel-file for client-side roster parsing, the
  Anthropic SDK, and zod.
- Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `evals`, `format`.
  `evals` is a placeholder that exits 0, wired from the first commit so the pipeline
  exists before the guardrails it will gate.
- Prettier, husky, and lint-staged, with a pre-commit hook.
- `scripts/check-denylist.mjs` — blocks identifying information from entering the
  repository. Structural patterns for email addresses and US phone numbers are
  committed; literal terms load from a gitignored `.denylist.local`, templated by
  `.denylist.local.example`. Failure output reports file, line, and pattern name only,
  never the matched text. Runs in the pre-commit hook and in CI.
- Secret scanning via gitleaks in the pre-commit hook, with `--redact`. Warns and
  continues when gitleaks is absent so a fresh clone is not blocked.
- CI (`.github/workflows/ci.yml`) on pull request and push to `main`: denylist, lint,
  typecheck, unit tests, build, with the pnpm store cached.
- Eval workflow (`.github/workflows/evals.yml`) on pull request and manual dispatch
  only, since the suite spends real API budget. Able to fail the build. Fork pull
  requests are skipped, because secrets are unavailable to them and a keyless run
  would look like a guardrail regression rather than a missing credential.
- CodeQL analysis (`javascript-typescript`) on pull requests and weekly.
- Dependabot for npm and GitHub Actions, weekly, minor and patch grouped so that a
  major version bump gets its own review.
- `SECURITY.md`, `.env.example`, an Apache 2.0 `LICENSE`, a pull request template, and
  this changelog.
- ADR-0001 (public/private split), ADR-0002 (invitation design), and ADR-0003
  (spreadsheet parsing library), each recording the rejected alternatives alongside the
  decision.
- ADR-0004 — encryption seam in the data layer; passphrase-derived encryption at rest
  deferred to the private fork. Declines to build the control in the public build: it
  closes one row of a five-row threat table and introduces a permanent data-loss path
  into the workflow the project exists to make reliable. The seam ships; the
  cryptography is gated on a key-recovery story.
- ADR-0005 — device dictation only; no microphone permission, no audio storage, no
  transcription service. A transcription call would be a second egress, and dictated
  text is treated as untrusted input.
- `docs/adr/README.md` — index of all five records, and the convention they follow:
  immutable once accepted, superseded when a decision changes, amended in place with a
  dated note when a consequence is added.

### Changed

- Spreadsheet parsing moves from `xlsx` (SheetJS) to `read-excel-file`. See ADR-0003.
- ADR-0003 amended with two consequences surfaced while planning session 8: the loss of
  legacy `.xls` support, which roster import must detect and explain rather than fail
  on, and `read-excel-file`'s less-proven handling of pathological real-world
  spreadsheets. The decision is unchanged.
- `PROJECT-PLAN.md` and `BUILD-GUIDE.md` revised to record Phase 0 as shipped and moved
  into `docs/`, where CLAUDE.md locates them. Plan §5 now separates the stack that is
  installed from the stack that is chosen but not yet installed. Session estimates
  revised: Phase 1 ~22 hours, Phase 2 ~8.5, public total ~51.5, with the private-fork
  encryption session excluded from that total.
- ADR-0004 amended with the full-disk-encryption premise its threat table rests on,
  verified rather than assumed: `fdesetup status` reported `FileVault is On` on
  2026-09-01, on the machine the private fork is intended to run on. Recorded as a dated
  dependency of the record — nothing in the repository detects or enforces FileVault, so
  the analysis needs re-running if it is ever disabled. The dependency applies to row 1
  of the table only; row 2 rests on a different premise. The decision is unchanged.
- ADR-0005 amended, and build guide session 5 extended, so the single-egress claim in
  plan §4.1 becomes a CI check rather than a prose assertion: from session 5 the build
  fails when a network destination other than the model API route appears in `src/`. The
  initial check is a grep and is recorded as catching the careless case rather than the
  determined one, scheduled to tighten in session 15. The check is owed, not yet written.
  The decision is unchanged.

### Security

- Removed `xlsx@0.18.5`, resolving four open high-severity Dependabot alerts:
  CVE-2023-30533 (prototype pollution) and CVE-2024-22363 (ReDoS). No registry update
  could fix these — `0.18.5` is the newest version published to npm, and the patched
  releases exist only on the vendor's own CDN. The vulnerable path is parsing a crafted
  spreadsheet, which is exactly what roster import will do on untrusted files, so the
  alerts were not dismissible as unreachable. The replacement is read-only by design:
  the application never writes spreadsheets, and a parser that cannot write is a
  smaller thing to trust. ADR-0003 records the rejected alternatives, including pinning
  the vendor CDN tarball via a pnpm override.
- All GitHub Actions are pinned to a commit SHA rather than a floating tag, with the
  version in a trailing comment so Dependabot can still bump them.
- `.gitignore` uses wildcard-plus-negation for `.env*` and `.denylist.local*`, so
  editor backups and hand-made copies of a secret file are ignored by default while
  the committed templates remain committable. A copy that `.gitignore` does not match
  is indistinguishable from the original and is a common route by which a local-only
  secret reaches a commit.
- The denylist term list is deliberately **not** committed. A file enumerating the
  names being protected would publish exactly what the check prevents, and hashing
  short proper nouns does not help. The documented consequence is that CI enforces
  structural patterns only; the literal-term check is local-only, and this is stated
  in the workflow and in the script header rather than left to be inferred from a
  green check.

### Notes

Prose is excluded from Prettier. The ADRs are hand-wrapped, and reflowing them
produces a diff touching every line, which makes the history of governance decisions
unreadable.

[Unreleased]: https://github.com/cp48isme/fieldnote/commits/main
