# Handoff

Written 2026-09-15, at the head of `feat/session-11-briefing`, the session 11 PR, for
the state `main` will be in when it merges. `main` is at `b0a1c4b`; the branch adds
eight commits including this one.

Every claim here was checked against the repository, git history, the trackers, or the
GitHub API in the session that wrote it. Where something could not be verified, it says
so rather than smoothing over the gap.

Regenerate this document from `docs/HANDOFF-TEMPLATE.md` at the end of each session, by
re-reading the sources. Do not edit the previous handoff in place — a handoff written
from the last handoff drifts from the repository it describes. This one was written from
the template with the previous handoff closed.

---

## What this is

A local-first PWA for a field representative running demonstration events for regulated
products. It captures attendee interactions in the field and drafts personalised
follow-up correspondence for human review; since session 11 it also lays out the
internal briefing she sends her own team before an event, from what she enters, and
downloads it. Full detail in `docs/PROJECT-PLAN.md`; `README.md` is the public front
door; this section is orientation only.

Two things shape everything else.

**Public build, private fork.** This repository is the de-branded public build:
synthetic data, no manufacturer, no product, no real people anywhere including commit
history — and no photograph of anyone: the one image in the tree is a flat colour with
invented initials, built by a script. A private fork carries real configuration and the
real approved content, and is never published. ADR-0001 is the record.

**Governance is load-bearing, not decorative.** The compliance architecture is
production code held to the same standard as any feature. A control is expected to be
*enforced*, not asserted: the denylist runs in a pre-commit hook and in CI; the
data-access boundary, the single-egress claim, the one-model-call rule, the draft state
machine, the no-draft-without-its-record invariant, and — since this session — the rule
that a contact never reaches the generation layer are failing tests; the security
headers are asserted against a live response; the adversarial suite runs against the
live model and fails the build if a violation reaches a draft; a roster import and a
briefing download are each shown to make no network request; claim-bearing text is
selected from the library or blocked, never authored; and where a control cannot be
enforced the documentation says so plainly. `CLAUDE.md` carries the non-negotiable
constraints.

---

## Where we've been

`main` is at `b0a1c4b` with 195 commits and 38 merged pull requests; this PR adds eight
commits. `CHANGELOG.md` is the record of what each session shipped, from session 2
onward, and is not repeated here. What follows is the map from session to pull request,
with the closed-not-merged ones named because a closed PR is easy to mistake for one that
never existed.

- **Phase 0, session 1** — two direct commits (`989d459`, `d509dca`), then **#6**, **#7**,
  **#8**. Dependabot **#1**, **#2**, **#4** merged. **#3** and **#5** closed, not merged:
  #3 was the `eslint-config-next` 16 bump that issue #11 tracks as a migration.
- **Documentation** — **#9**, **#10**; **#14** added this document and its template;
  **#16**, **#17**, **#18**; **#24**, **#25**.
- **Session 2, data layer** — **#12**. **Beads** — **#13**.
- **Session 3, capture and offline** — **#15**.
- **Session 4, the privacy boundary** — **#19**; ADR-0006.
- **First device run** — **#20** to **#23**; the certificate authority and the hardware
  walk, **#28** to **#31**.
- **Session 5, generation** — **#32**; ADR-0007; the containment of the beads database
  (see *Known gaps*).
- **Between sessions 5 and 6** — **#33**, **#36**. Dependabot **#26**, **#27**, **#35**
  closed, not merged, each with the reason on it.
- **Session 6, audit log and review gate** — **#37**; ADR-0008. **Between 6 and 7** —
  **#38**. Dependabot **#34** merged.
- **Session 7, adversarial eval suite** — **#39**. **Between 7 and 8** — **#40**, ruleset
  1.2.0 from the first held-out run.
- **Session 8, roster import** — **#41**; ADR-0003 amended.
- **Session 10, ADR-0009, the attendee view, and the clinician field** — **#42**, merged
  after **#43**, which recorded plan §7 item 4 as received.
- **Session 9, the approved content library** — **#44**; prompt template 1.2.0, ruleset
  1.3.0, schema v5, ADR-0008 amended.
- **Session 11, the briefing** — this PR, eight commits in the order the prompt set:
  ADR-0010 and the dependency it chose; the cipher's second shape with ADR-0004's note;
  schema v6 with the images and contacts tables and the boundary test; the photo path
  on the attendee view with the synthetic fixture and its generator; the document
  composed and drawn; the briefing screen with Generate; the guide, the prompt file, and
  the ADR index; this handoff with the changelog.

Verified with `git log`, `git rev-list --count main`, and `gh pr list`.

---

## Where we are

`main` is at `b0a1c4b`, CI green. No pull requests are open besides this one. Zero open
Dependabot alerts; `pnpm audit` clean after the one dependency this session added.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, deliberate for a single-maintainer repository. Verified against the
branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (283), build, and the end-to-end suite (35). `Adversarial guardrail suite`
runs live on this PR — not because anything that reaches the model changed, but because
schema v6 added fields to two watched fixtures, the eval runner's event and the roster;
it costs about sixteen cents and proves nothing new. On a PR that touches none of the
watched paths it skips the model and says so. The caveats, unchanged from session 9
except where marked:

- **The eval figures are one held-out run at five samples per case**, in `README.md`,
  dated; the two passage-class rows are calibration figures, and the next run is the
  held-out one for them. The twelve original detectors are frozen. Prompt injection has
  no rule behind it; the ruleset over-blocks relational sentences (`fieldnote-ay2`).
- **The briefing has never carried a real photograph**, new. Every image that has been
  resized, stored, drawn, or shown is the script-built fixture or a flat colour the
  end-to-end spec builds in memory. The resize decodes with `createImageBitmap`, whose
  EXIF orientation handling on the target phone is unobserved; a phone photo taken
  upright may or may not come out upright. The canvas surface's header says so.
- **The PDF library is unmaintained**, new, by decision (ADR-0010): last published May
  2022, no advisory on record, no patch path if one is ever filed. The standard fonts
  cover Western European Latin; a name outside it is drawn as "?".
- **The matcher is exact and the exemption is only as safe as loading is strict.** An
  approved span passes every rule, so the library refuses a passage at load on four
  rules and the structural guard. Real approved copy has still never been loaded.
- **The token class is a field a human sets or corrects.** The dock writes `hcp` for a
  typed Dr or Prof and `staff` otherwise; the view corrects either.
- **The attendee view's history is joined by canonical name**: a rename at one event
  detaches that record from the person's history at others (`fieldnote-m28`).
- **The roster import's "never touches the network" is one recorded run** on the
  fixtures, and so is the briefing's. **The matcher's bases were chosen, not measured.**
- **The single-egress check is a grep**; **SRI is partial** (`fieldnote-9gp`); **CI
  enforces structural denylist patterns only**; **the end-to-end suite runs in one
  browser**; **the service worker's update path is untested** (`fieldnote-unp`).

**The briefing exists, and the model writes none of it.** `src/lib/briefing/` composes
a document model from the event, its contacts, and its attendees with their photos, and
draws it with `pdf-lib` on a page that fits both A4 and Letter, a two-line footer on
every page stating the event, the generation time, and that the attendee list is
expected attendance as of that date. `BriefingInput` has no place for the dictated
notes, asserted by type. The screen is reached from the switcher; Generate is a
download through the same helper as the audit-log CSV; no record is written, because
nothing was generated (ADR-0009). Session 12's site map has its `purpose` value in the
images table and nothing writes it.

**Schema is at v6.** Five eligible dossier strings on the event; `briefingNotes` on the
attendee; `images` — bytes with a media type, one per owner and purpose, replaced on
re-upload, gone with the owner and with the event through its attendees; `contacts` —
per event, all eligible but the keys, never read by anything under `src/lib/generation/`
or `src/lib/privacy/`, which `tests/unit/contacts-boundary.test.ts` enforces. Migration
v6 backfills the strings and creates no rows; `tests/unit/migration-v6.test.ts` runs it
over v5 rows. The cipher seam carries two shapes (ADR-0004 as amended 2026-09-15): a
field's policy declares string or bytes, and a mismatch is refused in both directions.

**Versions.** Prompt template 1.2.0; guardrail ruleset 1.3.0; both unchanged this
session and recorded on every audit record.

**Documentation set.** `README.md`, `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`
(session 11 amended on completion, Phase 2 total revised to about eleven hours, session
12 noted), `docs/TESTING-ON-DEVICE.md`, ten ADRs with an index, `docs/prompts/` through
session 11, this handoff and its template, `CHANGELOG.md` through session 11,
`SECURITY.md`. Plan §4.6's `docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`,
`docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, and `docs/COMPLIANCE-MAP.md` do not
exist yet (checked with `ls docs`). `CLAUDE.md`'s list of decision records stops at
ADR-0005 and has since ADR-0006 landed; it points at the index, which is complete, but
the list itself is stale — a finding for the owner, since that file is not edited by a
session on its own account.

---

## What's next

### Session 12 — Email composer and logistics

Phase 3 begins. Read the guide's session 12 entry and its new note: the site map goes
in the `images` table under `purpose: "site-map"`, owned by the event, and the resize
and the bytes-shaped cipher are already there for it. ADR-0002 governs the invitation
design that sessions 12 to 14 build toward, and the non-negotiable that the system never
sends anything applies to a composer as much as to a follow-up: it composes, the
representative sends. Budgeted at ~3 hours.

Before it, or beside it, two things the repository cannot do for itself: a real phone
photo through the attendee view on the device, to see whether it comes out upright; and
the real approved content loaded in the private fork, still the first check owed since
session 9.

Either way: check the prompt's premises against the repository, and against any
dependency's own `package.json`, before building on them.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session: `.beads/config.yaml` has
`git-push: false` and the remote carries no `refs/dolt/*`. 54 issues: 28 open, 23
closed, 3 deferred, 17 ready, 11 blocked (`bd stats`). Run `bd ready` and `bd blocked`.

Named here because they qualify claims made above; the backlog itself is not listed.
`fieldnote-g7d` — the briefing package: what session 11 closed is in its notes; it
stays open for the site map and for the readout decision. `fieldnote-af9`, new — the
post-event readout and staff thank-yous, a second generation path with an internal
audience, split out of g7d and not decided. `fieldnote-ay2` — over-blocking has instances
and one cause fewer, no rate. `fieldnote-ao9` — the library body's encryption class, at
session 19; the images table's `bytes` field is classified eligible already.
`fieldnote-quj` — the two rulesets differ. `fieldnote-m28` — history joined by name.
`fieldnote-6qr` — a workbook with several sheets reads the first only. `fieldnote-5iv` —
the edit-distance dashboard. `fieldnote-9gp` — SRI. `fieldnote-dx0` — mangled clinical
terms. `fieldnote-ech` — the denylist matches listed spellings only. `fieldnote-bdw` —
Safari storage durability, which now covers photos as well as text. `fieldnote-unp` —
the service worker update path. `fieldnote-v2s` — the private fork has no session.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.

**Session prompts — what was asked.** `docs/prompts/`, one file per session through 11.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once accepted,
superseded or amended with a dated note. ADR-0010 landed this session and ADR-0004 was
amended. Still owed or worth considering: ADR-0004 again when `fieldnote-bdw` resolves;
ADR-0006's five-name evidence statement; the plan §2 conversation; and the decision
`fieldnote-af9` now holds, which probably wants an ADR before anything is built.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong.** Print a dependency's `package.json` exports when a prompt leans on
  them.
- **A dependency gets an ADR before it is installed**, in ADR-0003's shape, with the
  advisory material gathered on the day; a candidate with an open advisory is not
  installed. That is the project's rule; "no new dependency" was one session's prompt
  and was wrongly attributed to `CLAUDE.md` in the previous handoff.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself.
- **Verify by running, not by reasoning.** Every counterfactual named in a test header
  was run. Rasterise a rendered page and look at it; the footer that read "as of 15" was
  found that way and not by a test.
- **`pnpm evals` costs real spend.** Run it deliberately, count the runs, and report the
  total. A schema change that touches a watched fixture makes the gate run live on the
  PR; say so.
- **The Content Security Policy is a control, not a setting.** When it refuses something
  — a `blob:` image, say — find the path that needs no widening before touching the
  header the suite asserts.
- **Check what is listening before trusting a red or green e2e run.** `lsof -iTCP:3000`.
- **The denylist can fire on ordinary vocabulary and on any address-shaped string.**
  Remove the word rather than bypass the hook, and do not name it in the commit.
- **Check existence and ignore status separately.** `git check-ignore` is a pattern query.
- **The constraints in `CLAUDE.md` are not optional.**
- **A finding about the private material is not written into any location the
  repository controls.**
- **Never `--no-verify`.** Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks, including every `bd` command.
- **`bd update --notes` replaces the field.** Read the existing notes first and write
  them back with the addition.
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** Prettier reformats committed files, so anchor an edit on what
  is in the file. A file write carrying a literal control character or byte-order mark
  is refused by the harness; write escapes. A script the end-to-end suite imports is
  transpiled as CommonJS and must not use `import.meta`.
- **One session, one PR.** Findings that are not blocking get beads.
- **Separate commits per logical change.** An ADR and its consequences come before any
  code that depends on them. Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **No real photograph has been through the photo path**, and no phone has run this
  build. EXIF orientation through `createImageBitmap` on iOS is unobserved.
- **The PDF has been looked at as a rasterised page on one machine**, two pages of the
  fixture event, and never printed on either paper size it is laid out for.
- **The library has never held real approved copy.** Still the first check owed.
- **The two passage-class eval rows were measured with a detector fixed in the same
  session**; the next run is the held-out one.
- **The migration test runs the upgrade function over fake rows**, not Dexie's own
  upgrade transaction against IndexedDB. A populated v5 store has not been upgraded.
- **`deleteAttendee` exists in the repository with its cascade and a test, and nothing
  in the interface calls it.** Removing a person is not a feature yet.
- **The eval figures are one held-out run, one day.**
- **The containment amendment of 2026-09-09 is not reproduced here.** Its full text is in
  the handoff at commit `2dbdcb1`; its conclusions stand.
- **The hardware run is one phone, one day, iOS 26.6.1.** Nothing built in sessions 5 to
  11 has been run on hardware.
- **The layout validation is one observed session**; the review surface, the import
  screen, the attendee view, the library, and the briefing have not been observed in use.
- **Storage durability across Safari's eviction window is untested.** `fieldnote-bdw`.
- **Nothing is deployed.** `fieldnote-6x5`, `fieldnote-ijg`.
- **The private fork has no session and this handoff has no visibility into it.**
- **Audit records grow without bound** by design (ADR-0008); session 16 owes retention.
- **A name with neither a title nor a roster entry is still missed.** ADR-0006, ADR-0007.
- **Session-to-PR attribution before session 2 is partly inferred.**
- **Hours in the build guide are estimates, not measurements**, and Phase 2's total was
  revised upward this session on the same basis.

---

## How to use this

**Regenerate, do not edit.** Write each handoff by re-reading the sources — `git log`,
the build guide, `CLAUDE.md`, `docs/adr/README.md`, `bd ready`, `bd blocked`, and the
open GitHub issues.

**Point, do not copy.** Anything with a canonical home gets a pointer.

**Every claim traceable.** To a file, a commit, or a command run while writing. If it is
not, say so in *Known gaps* rather than dropping it silently or asserting it anyway.
