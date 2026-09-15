# Handoff

Written 2026-09-15, at the head of `feat/session-12-pre-event`, the session 12 PR, for
the state `main` will be in when it merges. `main` is at `977a3ff`; the branch adds
nine commits including this one.

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
follow-up correspondence for human review; it lays out the internal briefing she sends
her own team before an event; and, since session 12, it composes the pre-event email to
registered attendees from what she enters, with no model, under the same review gate as
a follow-up. Full detail in `docs/PROJECT-PLAN.md`; `README.md` is the public front
door; this section is orientation only.

Two things shape everything else.

**Public build, private fork.** This repository is the de-branded public build:
synthetic data, no manufacturer, no product, no real people anywhere including commit
history, no photograph of anyone, and no email address at any domain but the one RFC
2606 reserves. A private fork carries real configuration and the real approved content,
and is never published. ADR-0001 is the record.

**Governance is load-bearing, not decorative.** The compliance architecture is
production code held to the same standard as any feature. A control is expected to be
*enforced*, not asserted: the denylist runs in a pre-commit hook and in CI; the
data-access boundary, the single-egress claim, the one-model-call rule, the draft state
machine, the no-draft-without-its-record invariant, and the rule that a contact never
reaches the generation layer are failing tests; the security headers are asserted
against a live response; the adversarial suite runs against the live model and fails
the build if a violation reaches a draft; a roster import, a briefing download, and a
composed pre-event email are each shown to make no network request; claim-bearing text
is selected from the library or blocked, never authored, whoever typed it; and where a
control cannot be enforced the documentation says so plainly. `CLAUDE.md` carries the
non-negotiable constraints.

---

## Where we've been

`main` is at `977a3ff` with 204 commits and 39 merged pull requests; this PR adds nine
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
  after **#43**.
- **Session 9, the approved content library** — **#44**; prompt 1.2.0, ruleset 1.3.0,
  schema v5, ADR-0008 amended.
- **Session 11, the briefing** — **#45**; ADR-0010, ADR-0004 amended, schema v6.
- **Session 12, the pre-event email, the location, and the site map** — this PR, nine
  commits in the prompt's order: ADR-0011 with `CLAUDE.md`'s list completed; schema v7;
  the resize's settings and the site map in the briefing; the composer with the review
  surface made kind-aware; the composer screen with its end-to-end spec; the attendee
  delete and the denylist allowlist; the guide and the prompt file; a regex escape in the
  new spec that CodeQL flagged on the first push; this handoff with the changelog.

Verified with `git log`, `git rev-list --count main`, and `gh pr list`.

---

## Where we are

`main` is at `977a3ff`, CI green. No pull requests are open besides this one. Zero open
Dependabot alerts.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, deliberate for a single-maintainer repository. Verified against the
branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (299), build, and the end-to-end suite (37). `Adversarial guardrail suite`
runs live on this PR for one watched file — the eval runner's event fixture gained the
v7 location fields for the typecheck — and proves nothing new; nothing that reaches the
model changed. On a PR that touches none of the watched paths it skips the model and
says so. The caveats, unchanged from session 11 except where marked:

- **The pre-event email is composed by the application, judged by the same ruleset,
  and has never been sent to anyone**, new. The composer has been run on synthetic
  records only. Its subject and sign-off are fixed strings until a voice profile varies
  them.
- **The eval figures are one held-out run at five samples per case**, in `README.md`;
  the two passage-class rows are calibration figures, and **on this PR's second push the
  suite failed on one sample of passage-verbatim-1** — the detector fired, no rule did,
  the sentence reached the draft — on a diff that changed nothing the model sees. CI
  keeps no results file (`fieldnote-d8l`), fifteen local samples of the case were clean,
  and the failing sentence was never seen. The probable cause is a real gap, not a
  detector defect: a product sentence with a verb of state passes the claim-bearing
  rule (`fieldnote-877`, owner decision, ruleset 1.4.0 if confirmed). The ruleset
  over-blocks relational sentences (`fieldnote-ay2`), and it now judges the
  representative's own logistics text too, by decision (ADR-0011) — a comparison she
  types is blanked and she sees it.
- **No real photograph and no real site map has been through the resize.** Every image
  is the script-built fixture or a flat colour built in memory. EXIF orientation through
  `createImageBitmap` on the target phone is unobserved.
- **The PDF library is unmaintained** by decision (ADR-0010); standard fonts cover
  Western European Latin.
- **The matcher is exact and the exemption is only as safe as loading is strict.** Real
  approved copy has still never been loaded.
- **The token class is a field a human sets or corrects.** The attendee view can now
  remove a person, behind a confirmation that says what goes.
- **The attendee view's history is joined by canonical name** (`fieldnote-m28`).
- **The roster import's, the briefing's, and the composer's "no network request" are
  each one recorded run** on fixtures. **The matcher's bases were chosen, not measured.**
- **The single-egress check is a grep**, and the two map-link hosts appear in
  `src/lib/location/map-links.ts` as strings that no call site ever fetches — the check
  looks for call sites, not URL literals, and the file says so; **SRI is partial**
  (`fieldnote-9gp`); **CI enforces structural denylist patterns only**, and the email
  pattern now allows `example.com`; **the end-to-end suite runs in one browser**; **the
  service worker's update path is untested** (`fieldnote-unp`).

**Plan §3.3 is implemented except the `.ics` and the invite.** The composer
(`src/lib/preevent/compose.ts`) writes one draft per recipient: subject, greeting from
the record, her logistics, the location block — address, coordinates, Apple Maps and
Google Maps links built from the parsed pair, "Site map attached." while one is stored —
the selected passages verbatim, a sign-off. The body goes through `applyGuardrails` with
the library held out, once, and both hashes are over it below the greeting. Each outcome
is a `DraftRecord` of kind `pre-event` with an audit record whose model and template are
null (ADR-0011); the review surface labels it and explains a gap without naming a model.
The site map is stored with the event at 1600 PNG, downloaded from the composer as a
file, and drawn into the briefing. The forwardable block (ADR-0002, session 14) has a
named empty placeholder in the composer and nothing else.

**Schema is at v7.** `DraftRecord.kind`, backfilled `follow-up`; the event's `address`
and `coordinates`, one string validated on entry so the cipher keeps two shapes; the
audit record's `model` and `promptTemplateVersion` nullable, the CSV writing the empty
cell. Migration v7 with a test.

**Versions.** Prompt template 1.2.0; guardrail ruleset 1.3.0; both unchanged this
session — the ruleset was used, not changed — and recorded on every audit record.

**Documentation set.** `README.md`, `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`
(session 12 amended on completion; the session 11 site-map note corrected),
`docs/TESTING-ON-DEVICE.md`, eleven ADRs with an index and `CLAUDE.md`'s list now
complete, `docs/prompts/` through session 12, this handoff and its template,
`CHANGELOG.md` through session 12, `SECURITY.md`. Plan §4.6's `docs/ARCHITECTURE.md`,
`docs/AI-SYSTEM-CARD.md`, `docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, and
`docs/COMPLIANCE-MAP.md` do not exist yet (checked with `ls docs`).

---

## What's next

### Session 13 — Calendar generation

The guide's entry is one line: `.ics` output, "straightforward, high value, and nobody
does it." Read it with `fieldnote-5nc`, which session 12 left for it: the event has a
start and no end or duration, and a calendar entry needs both, so this is schema v8
before it is a file. The pattern is the site map's — a download from the pre-event
screen for her to attach in Mail, and the email saying a calendar entry is attached only
when one was produced — and the plan calls it the single highest-conversion element in
the email. Budgeted at ~2 hours. No model, no network, no dependency: an `.ics` is text.

Before it, or beside it, the checks the repository cannot do for itself remain: a real
phone photo and a real site map through the resize on the device, and the real approved
content loaded in the private fork.

Either way: check the prompt's premises against the repository, and against any
dependency's own `package.json`, before building on them.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session: `.beads/config.yaml` has
`git-push: false` and the remote carries no `refs/dolt/*`. 57 issues: 31 open, 23
closed, 3 deferred, 20 ready, 11 blocked (`bd stats`). Run `bd ready` and `bd blocked`.

Named here because they qualify claims made above; the backlog itself is not listed.
`fieldnote-d8l`, new — CI keeps no eval results file, so a failed sample cannot be
diagnosed. `fieldnote-877`, new — the probable verb-of-state gap in the claim-bearing
rule, for the owner. `fieldnote-5nc`, new — the event's missing end time, for session 13. `fieldnote-af9` —
the post-event readout, not decided. `fieldnote-g7d` — the briefing package, open for
the readout decision. `fieldnote-ay2` — over-blocking, now covering her own text too.
`fieldnote-ao9` — the library body's encryption class. `fieldnote-quj` — the two
rulesets differ. `fieldnote-m28` — history joined by name. `fieldnote-6qr` — a workbook
with several sheets. `fieldnote-5iv` — the edit-distance dashboard. `fieldnote-9gp` —
SRI. `fieldnote-dx0` — mangled clinical terms. `fieldnote-ech` — the denylist matches
listed spellings only. `fieldnote-bdw` — Safari storage durability. `fieldnote-unp` —
the service worker update path. `fieldnote-v2s` — the private fork has no session.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.

**Session prompts — what was asked.** `docs/prompts/`, one file per session through 12.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once accepted,
superseded or amended with a dated note. ADR-0011 landed this session. Still owed or
worth considering: ADR-0004 again when `fieldnote-bdw` resolves; ADR-0006's five-name
evidence statement; the plan §2 conversation; and the decision `fieldnote-af9` holds.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong.** Print a dependency's `package.json` exports when a prompt leans on
  them.
- **A dependency gets an ADR before it is installed**, in ADR-0003's shape, with the
  advisory material gathered on the day; a candidate with an open advisory is not
  installed.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself.
- **Verify by running, not by reasoning.** Every counterfactual named in a test header
  was run; the denylist allowlist was probed both ways with a staged file before it was
  committed.
- **`pnpm evals` costs real spend.** Run it deliberately, count the runs, and report the
  total. A schema change that touches a watched fixture makes the gate run live on the
  PR; say so.
- **The Content Security Policy is a control, not a setting.** Find the path that needs
  no widening before touching the header the suite asserts.
- **Check what is listening before trusting a red or green e2e run.** `lsof -iTCP:3000`.
- **The denylist can fire on ordinary vocabulary and on any address-shaped string** at
  any domain but `example.com`. Remove the word rather than bypass the hook, and do not
  name it in the commit.
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
  is in the file — read the wrapped text first; two edit scripts this session stopped on
  a line prettier had wrapped. A script the end-to-end suite imports is transpiled as
  CommonJS and must not use `import.meta`.
- **One session, one PR.** Findings that are not blocking get beads.
- **Separate commits per logical change.** An ADR and its consequences come before any
  code that depends on them. Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **No pre-event email has been sent to anyone.** The composer has run on synthetic
  records in the suites and on the fixture event once by hand; the sample in the prompt
  file is that one.
- **No real photograph and no real site map has been through the resize**, and no phone
  has run this build. EXIF orientation through `createImageBitmap` on iOS is unobserved.
- **The PDF has been looked at as a rasterised page on one machine** and never printed.
- **The library has never held real approved copy.** Still the first check owed.
- **The two passage-class eval rows were measured with a detector fixed in the same
  session**; the next run is the held-out one.
- **The migration tests run the upgrade functions over fake rows**, not Dexie's own
  upgrade transaction against IndexedDB.
- **The eval figures are one held-out run, one day**, and one CI sample on this PR
  failed the gate with a sentence nobody saw. The two local reruns that followed cost
  about $0.20 and reproduced nothing.
- **The containment amendment of 2026-09-09 is not reproduced here.** Its full text is in
  the handoff at commit `2dbdcb1`; its conclusions stand.
- **The hardware run is one phone, one day, iOS 26.6.1.** Nothing built in sessions 5 to
  12 has been run on hardware.
- **The layout validation is one observed session**; the review surface, the import
  screen, the attendee view, the library, the briefing, and the composer have not been
  observed in use.
- **Storage durability across Safari's eviction window is untested.** `fieldnote-bdw`.
- **Nothing is deployed.** `fieldnote-6x5`, `fieldnote-ijg`.
- **The private fork has no session and this handoff has no visibility into it.**
- **Audit records grow without bound** by design (ADR-0008); session 16 owes retention.
- **A name with neither a title nor a roster entry is still missed.** ADR-0006, ADR-0007.
- **Session-to-PR attribution before session 2 is partly inferred.**
- **Hours in the build guide are estimates, not measurements.**

---

## How to use this

**Regenerate, do not edit.** Write each handoff by re-reading the sources — `git log`,
the build guide, `CLAUDE.md`, `docs/adr/README.md`, `bd ready`, `bd blocked`, and the
open GitHub issues.

**Point, do not copy.** Anything with a canonical home gets a pointer.

**Every claim traceable.** To a file, a commit, or a command run while writing. If it is
not, say so in *Known gaps* rather than dropping it silently or asserting it anyway.
