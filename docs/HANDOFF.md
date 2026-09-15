# Handoff

Written 2026-09-15, at the head of `feat/session-13-calendar`, the session 13 PR, for
the state `main` will be in when it merges. `main` is at `2b863ea`; the branch adds
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
follow-up correspondence for human review; it lays out the internal briefing she sends
her own team; and it composes the pre-event email to registered attendees from what she
enters — with a calendar file beside it since session 13 — with no model, under the same
review gate as a follow-up. Full detail in `docs/PROJECT-PLAN.md`; `README.md` is the
public front door; this section is orientation only.

Two things shape everything else.

**Public build, private fork.** This repository is the de-branded public build:
synthetic data, no manufacturer, no product, no real people anywhere including commit
history, no photograph of anyone, and no address-shaped string outside the two shapes
RFC 2606 reserves. A private fork carries real configuration and the real approved
content, and is never published. ADR-0001 is the record.

**Governance is load-bearing, not decorative.** The compliance architecture is
production code held to the same standard as any feature. A control is expected to be
*enforced*, not asserted: the denylist runs in a pre-commit hook and in CI; the
data-access boundary, the single-egress claim, the one-model-call rule, the draft state
machine, the no-draft-without-its-record invariant, and the rule that a contact never
reaches the generation layer are failing tests; the security headers are asserted
against a live response; the adversarial suite runs against the live model, fails the
build if a violation reaches a draft, and — since this session — keeps every sample's
text so a failure can be read; a roster import, a briefing download, and a composed
pre-event email are each shown to make no network request; claim-bearing text is
selected from the library or blocked, never authored, whoever typed it; and where a
control cannot be enforced the documentation says so plainly. `CLAUDE.md` carries the
non-negotiable constraints.

---

## Where we've been

`main` is at `2b863ea` with 214 commits and 40 merged pull requests; this PR adds eight
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
- **Session 12, the pre-event email, the location, and the site map** — **#46**;
  ADR-0011, schema v7. Its second push failed the eval gate on one sample nobody saw,
  which is where this session's first two parts came from.
- **Session 13, the calendar file, ruleset 1.4.0, and the eval artifact** — this PR,
  eight commits: ruleset 1.4.0 with its cases and the gate test's new shape; the
  workflow artifact; the denylist's `.invalid` allowance; schema v8 and the `.ics`
  builder; the composer's times and download; the README table, the guide, and the
  prompt file; a semicolon escape in the calendar file that CodeQL's review caught on
  the first push; this handoff with the changelog.

Verified with `git log`, `git rev-list --count main`, and `gh pr list`.

---

## Where we are

`main` is at `2b863ea`, CI green. No pull requests are open besides this one. Zero open
Dependabot alerts.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, deliberate for a single-maintainer repository. Verified against the
branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (306), build, and the end-to-end suite (37). `Adversarial guardrail suite`
runs live on this PR because the ruleset changed, which is what it is for, and now
uploads the runner's results file as a seven-day artifact named by run id, pass or
fail. On a PR that touches none of the watched paths it skips the model and says so.
The caveats, unchanged from session 12 except where marked:

- **The eval figures are one held-out run at five samples per case**, in `README.md`,
  dated 2026-09-15 under ruleset 1.4.0 — and for the first time every row is held out,
  the two passage-class detectors having been frozen before the run. 0 of 70 reached,
  4 of 70 produced. **Over-blocking rose by decision**: the ruleset fired on 34 of 70
  samples against 29 of 60 under 1.2.0, because a product noun followed by a verb of
  state is now claim-bearing and "the system will be on the truck again" blocks with
  the rest (`fieldnote-ay2`). The review gate shows every gap.
- **The sentence that motivated 1.4.0 was never seen.** The rule was reconstructed from
  the detector's list and the rule's; the next failure will have its text.
- **The calendar file has been opened by no calendar application.** It is asserted line
  by line against the RFC on the fixture, and downloaded in one browser in the suite.
  UTC with `Z` and no timezone database, by decision: the phone converts.
- **The pre-event email has never been sent to anyone.** Synthetic records only.
- **No real photograph and no real site map has been through the resize.**
- **The PDF library is unmaintained** by decision (ADR-0010).
- **The matcher is exact and the exemption is only as safe as loading is strict.** Real
  approved copy has still never been loaded.
- **The attendee view's history is joined by canonical name** (`fieldnote-m28`).
- **Each "no network request" claim is one recorded run** on fixtures.
- **The single-egress check is a grep**; **SRI is partial** (`fieldnote-9gp`); **CI
  enforces structural denylist patterns only**, and the email pattern allows
  `example.com` and any `.invalid` domain, each with its reason in the script; **the
  end-to-end suite runs in one browser**; **the service worker's update path is
  untested** (`fieldnote-unp`).

**Plan §3.3 is implemented except the invite.** The composer writes one draft per
recipient under the gate (ADR-0011); the site map and now the calendar file download
beside it for her to attach in Mail, and the email says each is attached only when it
can be. The `.ics` (`src/lib/calendar/ics.ts`) carries the name, both ends in UTC, the
address, `GEO`, and a description of the address and the two map links, and no free
text — logistics prose would leave the device without the ruleset. The forwardable
block (ADR-0002, session 14) has a named empty placeholder in the composer and nothing
else.

**Schema is at v8.** `EventRecord.endsAt`, clear, null until entered, saved with the
start from the pre-event screen; an end at or before the start is refused. Migration
with a test.

**Versions.** Prompt template 1.2.0; guardrail ruleset **1.4.0**; both recorded on every
audit record.

**Documentation set.** `README.md` (eval table from this session's run),
`docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md` (session 13 amended on completion),
`docs/TESTING-ON-DEVICE.md`, eleven ADRs with an index and `CLAUDE.md`'s list complete,
`docs/prompts/` through session 13, this handoff and its template, `CHANGELOG.md`
through session 13, `SECURITY.md`. Plan §4.6's `docs/ARCHITECTURE.md`,
`docs/AI-SYSTEM-CARD.md`, `docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, and
`docs/COMPLIANCE-MAP.md` do not exist yet (checked with `ls docs`).

---

## What's next

### Session 14 — Invite feature

The guide's entry: "Design A per ADR-0002. Behind a flag, defaulted off, approved
content only, no tracking. The constraints make this smaller than it sounds." Read
ADR-0002 in full — its five constraints are enforced in code, not by policy — and
ADR-0011, which already puts the whole email under the ruleset. The composer has a
named empty placeholder for the forwardable block (`FORWARDABLE_PLACEHOLDER` in
`src/lib/preevent/compose.ts`) and nothing else; the flag is per event and needs a
field, so this is schema v9 before it is a block. The block carries logistics, the
location, timing, and library passages, and no tracking, no incentive, no collection of
anyone's details. Budgeted at ~2 hours. Phase 3 then closes.

Still owed and unchanged: a real photo and a real site map through the resize on the
device; the real approved content loaded in the private fork; a calendar application
opening the `.ics`.

Either way: check the prompt's premises against the repository — including whether the
previous PR has merged — before building on them.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session: `.beads/config.yaml` has
`git-push: false` and the remote carries no `refs/dolt/*`. 57 issues: 28 open, 26
closed, 3 deferred, 17 ready, 11 blocked (`bd stats`). Run `bd ready` and `bd blocked`.

Named here because they qualify claims made above; the backlog itself is not listed.
Closed this session: `fieldnote-5nc`, `fieldnote-877`, `fieldnote-d8l`. `fieldnote-ay2`
— over-blocking, now measured at 34 of 70 and higher by decision. `fieldnote-af9` — the
post-event readout, not decided. `fieldnote-g7d` — open for that decision.
`fieldnote-ao9` — the library body's encryption class. `fieldnote-quj` — the two
rulesets differ. `fieldnote-m28` — history joined by name. `fieldnote-6qr` — a workbook
with several sheets. `fieldnote-5iv` — the edit-distance dashboard. `fieldnote-9gp` —
SRI. `fieldnote-dx0` — mangled clinical terms. `fieldnote-ech` — the denylist matches
listed spellings only. `fieldnote-bdw` — Safari storage durability. `fieldnote-unp` —
the service worker update path. `fieldnote-v2s` — the private fork has no session.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.

**Session prompts — what was asked.** `docs/prompts/`, one file per session through 13.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once accepted,
superseded or amended with a dated note. None landed this session. Still owed or worth
considering: ADR-0004 again when `fieldnote-bdw` resolves; ADR-0006's five-name evidence
statement; the plan §2 conversation; and the decision `fieldnote-af9` holds.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong** — including "on `main` after PR #N", which was false once this session
  and was waited out rather than worked around.
- **A dependency gets an ADR before it is installed**; a file format that is stable and
  small is written by hand and tested against its RFC, as the `.ics` was.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself.
- **Verify by running, not by reasoning.** Every counterfactual named in a test header
  was run; every denylist allowance was probed both ways with a staged file.
- **`pnpm evals` costs real spend.** Run it deliberately, count the runs, and report the
  total. A ruleset change is what the held-out run is for.
- **The Content Security Policy is a control, not a setting.**
- **Check what is listening before trusting a red or green e2e run.** `lsof -iTCP:3000`.
- **The denylist can fire on ordinary vocabulary and on any address-shaped string** at
  any domain but `example.com` and `.invalid`. Remove the word rather than bypass the
  hook, and do not name it in the commit.
- **A refused commit leaves its files staged.** The next `git add` and commit takes them
  too; read `git status` before every commit, not just the first. One commit this
  session swallowed sixteen files that way and was split before anything was pushed.
- **Check existence and ignore status separately.** `git check-ignore` is a pattern query.
- **The constraints in `CLAUDE.md` are not optional.**
- **A finding about the private material is not written into any location the
  repository controls.**
- **Never `--no-verify`.** Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks, including every `bd` command.
- **`bd update --notes` replaces the field.** Read the existing notes first.
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** Prettier reformats committed files, so read the wrapped text
  before anchoring an edit on it.
- **One session, one PR.** Findings that are not blocking get beads.
- **Separate commits per logical change.** An ADR and its consequences come before any
  code that depends on them. Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **The calendar file has not been opened by Mail, Calendar, Outlook, or anything else.**
  Its correctness rests on the RFC and a line-by-line test — and the first version's
  semicolon escape did nothing, which that test did not catch because the fixture has
  no semicolon; CodeQL did. A fixture that exercises every escape is owed.
- **The 1.4.0 rule was written for a sentence nobody saw.** Three reconstructed shapes
  and one held-out run are the evidence that it closes the gap.
- **No pre-event email has been sent to anyone.**
- **No real photograph and no real site map has been through the resize**, and no phone
  has run this build. EXIF orientation through `createImageBitmap` on iOS is unobserved.
- **The PDF has been looked at as a rasterised page on one machine** and never printed.
- **The library has never held real approved copy.** Still the first check owed.
- **The migration tests run the upgrade functions over fake rows**, not Dexie's own
  upgrade transaction against IndexedDB.
- **The eval figures are one held-out run, one day.**
- **The containment amendment of 2026-09-09 is not reproduced here.** Its full text is in
  the handoff at commit `2dbdcb1`; its conclusions stand.
- **The hardware run is one phone, one day, iOS 26.6.1.** Nothing built in sessions 5 to
  13 has been run on hardware.
- **The layout validation is one observed session**; nothing built since has been
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
