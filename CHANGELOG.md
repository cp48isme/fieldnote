# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
