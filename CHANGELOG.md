# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Session 16 — the data protection assessment

- `docs/DATA-PROTECTION.md`: purpose and the four kinds of data subject; the inventory
  of all eleven tables, every field with the schema's own reason, nothing re-classified;
  six flows in text, each with what enters, what is stored, what leaves, and by whose
  action, the platform's dictation and backup named as unverified; retention as the
  owner decided it, changed 2026-09-17, and as not yet built; minimisation as decisions with
  the file that enforces each; rights and their limits, including what the cascade test
  does and does not prove; the one processor and what is not verified about it;
  residual risk citing the threat model's §6 by item and adding bead-backed items only.
  No legal characterisation: that is session 17's.
- No code changed; the eval gate skipped.

### Session 15 — the threat model

- `docs/THREAT-MODEL.md`: what is protected and from whom; four boundaries with a text
  diagram; STRIDE per boundary, every control naming the file that enforces it or
  saying it is documented only; prompt injection through dictated input as the
  first-class entry, with what reaches the draft and what shows it; six worked entries
  from their beads — ignore globs and their templates, required checks coupled to job
  names, the lockfile superset, installed tooling rewriting the repository's controls,
  the beads publication of 2026-09-09, and device auto-lock as a private-fork
  precondition; residual risk in one section, each item with its bead or ADR.
- `tests/unit/required-checks.test.ts`: the rendered job names in the three workflows
  are exactly the three contexts branch protection requires, a `${{ matrix.* }}`
  template resolved against the job's matrix, a missing workflow a failure. The
  tripwire for a rename; the settings half of the coupling stays a hand check.
- Amended after review: §5.5 brought to the owner's decision on the private material;
  five beads opened for the items flagged at the end of the session, and the document
  amended for two of them — the event name and the approved passages crossing outside
  the note delimiter, and the provider's retention arrangement.
- Phase 4 opens.

### Session 14 — the invite feature: the forwardable block behind its flag

- Schema v9: `EventRecord.forwardableEnabled`, false on creation and backfilled false.
  A switch on the pre-event screen turns it on per event, saved as toggled.
- The forwardable block (ADR-0002, Design A): when the flag is on, the pre-event email
  ends with a self-contained part the recipient can pass on — the event's name, when,
  where, the logistics, and the selected passages between four fixed strings. No input
  of its own, the same for every recipient, the two map links its only URLs, through the
  ruleset with the rest of the body, and without the attachment lines.
- Each of ADR-0002's five constraints is a unit test; ADR-0002 is amended with where
  each is enforced. Phase 3 closes.

### Session 13 — the calendar file, ruleset 1.4.0, and the eval artifact

- Ruleset 1.4.0: a product noun followed by a verb of state or design is claim-bearing,
  and the noun list gains the parts the passage detector names. Held-out run 2026-09-15:
  0 of 70 reached the draft, 4 of 70 produced; the README carries the table.
- The eval workflow keeps `evals-results.json` as a seven-day artifact on every live
  run, pass or fail, so a failed sample can be read.
- Schema v8: `EventRecord.endsAt`. Start and end are entered on the pre-event screen.
- The calendar file: RFC 5545 by hand, one `VEVENT` with both ends in UTC, the name, the
  address, `GEO`, and a description of the address and the two map links only; no
  attendee, no organizer, no free text. Downloaded from the composer, disabled until the
  event has both ends; the email says a calendar invitation is attached when it does.
- The denylist allows an identifier at a `.invalid` domain (RFC 2606), for the file's
  `UID`.

### Session 12 — the pre-event email, the location, and the site map

- ADR-0011: a pre-event email is a draft under the review gate, model or not; the
  ruleset judges the whole email, the representative's own text included.
- Schema v7: `DraftRecord.kind` (`follow-up` | `pre-event`); the event's `address`
  and `coordinates`, one "lat, lng" string validated on entry; the audit record's
  `model` and `promptTemplateVersion` nullable, with the CSV writing the empty cell.
- The composer: one draft per recipient from the record's greeting, her logistics, the
  location block with Apple Maps and Google Maps links built from the coordinates, "Site
  map attached." while one is stored, the selected library passages verbatim, and a
  sign-off; the body through the guardrails with passages exempt. No model, no prompt,
  no network. Drafts land in the review surface labelled as pre-event emails.
- The site map: stored with the event at 1600 pixels as PNG, downloaded from the
  composer as a file to attach in Mail, drawn into the briefing's Event section. The
  resize takes its settings: 512 JPEG for a photo, 1600 PNG for a map.
- Folded in: the attendee view removes a person behind a confirmation that says what
  goes; the denylist allows `example.com` addresses in fixtures (RFC 2606);
  `CLAUDE.md`'s decision-record list completed through ADR-0011.

### Session 11 — the briefing

- ADR-0010: `pdf-lib` draws the briefing, chosen over `jspdf` and the browser print
  path on the registry and advisory material for each; the smaller thing to trust, and
  unmaintained, which the record states.
- The cipher seam carries two shapes: bytes beside strings, a field's policy declaring
  which, a mismatch refused in both directions (ADR-0004 amended). Images are stored as
  bytes with a media type, never as a `Blob`.
- Schema v6: five dossier fields on the event; briefing notes on the attendee; an
  `images` table, one per owner and purpose, gone with its owner; a `contacts` table for
  the representative's own team and the site's people, which never enters a model call
  and is fenced off from the generation and privacy layers by a test.
- Photos: chosen on the device, never fetched, resized to 512 pixels on the longest edge
  as JPEG through a pure function over a drawing surface, uploaded and shown on the
  attendee view beside the briefing notes. A synthetic photo fixture with its generator.
- The briefing screen from the event switcher — event and dossier, contacts, attendees
  with thumbnails as doors into the attendee view, Generate — and the document: composed
  from records, drawn on a page that fits A4 and Letter, every page stating the event,
  the generation time, and that the attendee list is expected attendance as of that date.
  Downloaded, never sent; no record written, nothing having been generated by a model.
  The dictated notes are not in it.

### Session 9 — the approved content library

- The library: passages entered one at a time — label, body, and the approving
  document's code and version — from an "Approved content…" option in the event
  switcher. A passage is refused at load, with the rule named, when the pricing,
  hospitality, patient, or invented-name rule fires on it or the pseudonymizer's
  structural guard would. The public build ships with it empty.
- The matcher (`src/lib/generation/approved.ts`): exact, whole passage, after whitespace
  and quote-and-dash normalisation with case kept, nothing looser. Approved spans are held
  out of every rule and put back as the library wrote them; a reworded passage is blocked
  as claim-bearing with the gap marker. Ruleset 1.3.0 carries the exemption and stops
  reading "rather than" as a comparison.
- Prompt template 1.2.0: with passages in the request the model is told to select and
  copy exactly; with none, the empty-library wording is unchanged. Passages travel in the
  request with length caps and are protected in the route before its private-term rule.
- Schema v5: the audit record carries `passagesUsed` and `libraryVersion`, a SHA-256 over
  the library's normalised bodies; the CSV has both columns; the detail view says "N
  approved passages used". ADR-0008 amended: a removed passage stays referenced by id.
- Five invented passages as fixtures and two eval classes, passage-verbatim and
  passage-paraphrase, with the held-out figures and their cost in `README.md`.
- The dock classifies a typed Dr or Prof as a clinician, the rule import already used
  (`fieldnote-frx`).

### Session 10 — ADR-0009, the attendee view, and the clinician field

- ADR-0009: the briefing is a document the representative writes and downloads; the
  application lays it out and never sends it; the model writes none of it; deal
  positioning is not in the public build. Plan §3.2's suggested openers and selected
  talking points are withdrawn; photo upload moves to session 11.
- Schema v4: `Attendee.kind` is `hcp` or `staff`, plan §4.1's own words, backfilled from
  the old heuristic so nothing stored changes class. The pseudonymizer reads the field
  and nothing else; the dock writes `staff`; import writes `hcp` from a title of Dr or
  Prof; a merge never reclassifies. The migration has a unit test.
- The attendee view: one person's record, editable, with `source` shown read-only, their
  notes and drafts across every event on the device joined by canonical name and saying
  so, and a first line saying nothing is fetched. Reached from the event switcher's
  "People at this event…", beside the other two options.

### Session 8 — roster import

- Sign-in sheets and registration lists import on the device: `.xlsx` through
  `read-excel-file`, `.csv` through a forty-line reader of our own (the library has no
  CSV support, contrary to ADR-0003's consequence, now amended), `.xls` refused by its
  magic bytes with an instruction to re-save. Every cell is sanitised before anything
  sees it; the file never touches the network, shown by an end-to-end spec that records
  every request during an import.
- A header found under banners and blank rows, a merged header cell's sub-labels joined
  to it, and column guesses by header text with a title column prepended to the name so
  the greeting keeps its title.
- A matcher that compares canonical names — exact, then surname, then one edit on a
  surname of five or more letters — and proposes; the representative confirms each
  proposal and nothing merges silently. A confirmed match fills an existing attendee's
  empty role, specialty, and institution and never the display name. Swali/Swelha is
  missed by design.
- Schema v3: `Attendee.source` records whether a person was met at the event or listed
  on a sheet, because the roster is an intention, not a record.
- The import lives in the event switcher beside "Start a new event…"; the dock's
  add-person flow is untouched. A messy synthetic `.xlsx` fixture, built by a script with
  no dependency, is what "imports correctly" means.

### Between sessions 7 and 8

- Guardrail ruleset 1.2.0: the indication rule gains a phrase list for regulatory
  language beyond "cleared for" — "cleared population", "clearance", "outside the label"
  and kin — after the first held-out eval run let "use outside the cleared population"
  reach a draft on 1 of 60 samples. Not a bare "cleared".
- The first held-out eval runs, at five samples per case with the detectors frozen since
  #39: 1 of 60 reached under 1.1.0, 0 of 60 under 1.2.0. The live counterfactual against
  the final detectors passed, because the model echoes rather than adopts; the
  claim-bearing rule's necessity is demonstrated by the deterministic gate test only.
- The README's eval section tells that story in order, with the held-out run as the
  headline and the calibration run as one line.

### Session 7 — adversarial eval suite

- A corpus of twelve cases across plan §4.5's seven classes, built from the public
  fixtures' dictation artifacts and never from `private/`, each with its own narrow
  detector separate from the ruleset, so the prompt-level rate is not measured by the
  instrument that enforces it.
- A runner that sends each case through the real pipeline with the model call shared
  with the route (`model-call.ts`, extracted so the two cannot drift), and records per
  sample whether the model produced the violation, whether the ruleset caught it, and
  whether it reached the draft. The gate is the last, at 100%.
- The entry decides from the diff against the base whether to call the model, and skips
  with a log line naming what it checked on an unrelated change; `workflow_dispatch`
  always runs live. One full run costs about $0.14.
- A deterministic gate test in `Verify`: a removed rule lets each class's failed-prompt
  shape reach the draft. Demonstrated live too, once.
- The first `README.md`: what the project is, what it deliberately does not do, and the
  results of one run — the violation reached the draft on 0 of 12, the model produced it
  on 1 of 12.

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
