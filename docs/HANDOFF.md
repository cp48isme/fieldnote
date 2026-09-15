# Handoff

Written 2026-09-15, at the head of `feat/session-14-invite`, the session 14 PR, for the
state `main` will be in when it merges. `main` is at `aaed981`; the branch adds five
commits including this one.

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
enters, with a calendar file beside it and — since session 14, when she turns it on for
an event — a part the recipient can pass on to a colleague, with no model, under the
same review gate as a follow-up. Full detail in `docs/PROJECT-PLAN.md`; `README.md` is
the public front door; this section is orientation only.

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
build if a violation reaches a draft, and keeps every sample's text so a failure can be
read; a roster import, a briefing download, and a composed pre-event email are each
shown to make no network request; claim-bearing text is selected from the library or
blocked, never authored, whoever typed it; ADR-0002's five constraints on the
forwardable block are each a failing test; and where a control cannot be enforced the
documentation says so plainly. `CLAUDE.md` carries the non-negotiable constraints.

---

## Where we've been

`main` is at `aaed981` with 223 commits and 41 merged pull requests; this PR adds five
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
  ADR-0011, schema v7.
- **Session 13, the calendar file, ruleset 1.4.0, and the eval artifact** — **#47**;
  schema v8.
- **Session 14, the invite feature** — this PR, five commits: schema v9 and the flag;
  the block in the composer with each constraint a test; the switch on the screen and
  the end-to-end spec; ADR-0002 amended, the guide, and the prompt file; this handoff
  with the changelog. Phase 3 closes.

Verified with `git log`, `git rev-list --count main`, and `gh pr list` (41 merged; #3,
#5, #26, #27, #35 closed without merging).

---

## Where we are

`main` is at `aaed981`, CI green. No pull requests are open besides this one. Zero open
Dependabot alerts.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, deliberate for a single-maintainer repository. Verified against the
branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (314), build, and the end-to-end suite (37). `Adversarial guardrail suite`
runs live on this PR — not because anything the model sees changed, but because the eval
runner's synthetic event is typed as the record and gained the new field, and
`tests/evals/` is a watched path; about $0.16. On a PR that touches none of the watched
paths it skips the model and says so. The caveats, unchanged from session 13 except
where marked:

- **The eval figures are one held-out run at five samples per case**, in `README.md`,
  dated 2026-09-15 under ruleset 1.4.0, every row held out. 0 of 70 reached, 4 of 70
  produced. The ruleset fired on 34 of 70 samples, higher by decision (`fieldnote-ay2`).
  Nothing in this session changes them: prompt and ruleset are untouched.
- **The forwardable block has been forwarded by nobody** (new). Its constraints are
  tests over synthetic records; no email carrying it has left a mail client.
- **Two of the five constraint tests are word lists** (new). "No incentive" and "no
  collection of details" hold structurally — the block has no input of its own — and the
  test that reads the four fixed strings against the ruleset and against a list of the
  words an offer or a request would use is a check on those strings, not a proof about
  language. A future edit to the fixed strings is what it guards.
- **The sentence that motivated 1.4.0 was never seen.** The next failure will have its
  text: CI keeps the results file.
- **The calendar file has been opened by no calendar application.** Line by line
  against the RFC on the fixture; UTC with `Z`, the phone converts.
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

**Plan §3.3 and §3.4 are implemented; Phase 3 closes.** The composer writes one draft
per recipient under the gate (ADR-0011); the site map and the calendar file download
beside it; and when the event's flag is on the email ends with ADR-0002's block
(`forwardableBlock` in `src/lib/preevent/compose.ts`): the event's name, when, where,
the logistics, and the selected passages between four fixed strings, no input of its
own, the same for every recipient, the two map links its only URLs, through the ruleset
with the rest of the body, and without the attachment lines. ADR-0002 is amended with
where each constraint is enforced.

**Schema is at v9.** `EventRecord.forwardableEnabled`, clear, false on creation and
backfilled false; `updateEventForwardable` sets it for one event. Migration with a test.

**Versions.** Prompt template 1.2.0; guardrail ruleset 1.4.0; both recorded on every
audit record. Neither changed this session.

**Documentation set.** `README.md` (eval table from session 13's run),
`docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md` (session 14 amended on completion),
`docs/TESTING-ON-DEVICE.md`, eleven ADRs with an index and `CLAUDE.md`'s list complete,
`docs/prompts/` through session 14, this handoff and its template, `CHANGELOG.md`
through session 14, `SECURITY.md`. Plan §4.6's `docs/ARCHITECTURE.md`,
`docs/AI-SYSTEM-CARD.md`, `docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, and
`docs/COMPLIANCE-MAP.md` do not exist yet (checked with `ls docs`); session 15 starts
on the third.

---

## What's next

### Session 15 — Threat model

Phase 4 opens. The guide's entry: STRIDE, with prompt injection via dictated input as a
first-class entry, because dictation is an untrusted input channel (ADR-0005); three
Phase 0 findings as worked entries — the sibling-file leak path in `.gitignore`, the
same bug class in `.env*`, and required status checks depending on job display names;
and ADR-0004's accepted residual risk stated plainly. Budgeted at ~3 hours. The bead is
`fieldnote-loh`, deferred, and the seven beads blocked on it are the entries the
sessions since Phase 0 have owed it — `bd blocked` lists them; the beads publication
finding of 2026-09-09 is one, and its full text is in `fieldnote-loh`'s notes. Read the
guide's entry in full; the bead exists to hang dependencies from and does not repeat it.

Still owed and unchanged: a real photo and a real site map through the resize on the
device; the real approved content loaded in the private fork; a calendar application
opening the `.ics`; and now a forwarded block read in a second mail client.

Either way: check the prompt's premises against the repository — including whether the
previous PR has merged — before building on them. Session 14 had no Guardian prompt;
`docs/prompts/session-14.md` says so and why, and session 15 should have one.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session: `.beads/config.yaml` has
`git-push: false` and the remote carries no `refs/dolt/*`. 58 issues: 28 open, 27
closed, 3 deferred, 17 ready, 11 blocked (`bd stats`; `bd ready` counts 18, and the two
commands have disagreed by one since session 13). Run `bd ready` and `bd blocked`.

Named here because they qualify claims made above; the backlog itself is not listed.
Closed this session: `fieldnote-f30`, the session's own bead. `fieldnote-loh` — session
15, deferred, with seven blocked on it. `fieldnote-ay2` — over-blocking, 34 of 70 by
decision. `fieldnote-af9` — the post-event readout, not decided. `fieldnote-g7d` — open
for that decision. `fieldnote-ao9` — the library body's encryption class. `fieldnote-quj`
— the two rulesets differ. `fieldnote-m28` — history joined by name. `fieldnote-6qr` — a
workbook with several sheets. `fieldnote-5iv` — the edit-distance dashboard.
`fieldnote-9gp` — SRI. `fieldnote-dx0` — mangled clinical terms. `fieldnote-ech` — the
denylist matches listed spellings only. `fieldnote-bdw` — Safari storage durability.
`fieldnote-unp` — the service worker update path. `fieldnote-v2s` — the private fork has
no session.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.

**Session prompts — what was asked.** `docs/prompts/`, one file per session from 3
through 14. Session 14's was written in-session, not by Guardian, and the file says so.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once accepted,
superseded or amended with a dated note. ADR-0002 amended this session. Still owed or
worth considering: ADR-0004 again when `fieldnote-bdw` resolves; ADR-0006's five-name
evidence statement; the plan §2 conversation; and the decision `fieldnote-af9` holds.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong** — including "on `main` after PR #N".
- **A prompt written in-session is a weaker record than one written before contact with
  the repository.** It happened once, in session 14, with the gap named; it is not the
  pattern.
- **A dependency gets an ADR before it is installed**; a file format that is stable and
  small is written by hand and tested against its RFC.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself.
- **Verify by running, not by reasoning.** A browser's locale data and Node's are not
  the same; a controlled input does not flip until its record does.
- **`pnpm evals` costs real spend.** Run it deliberately, count the runs, and report the
  total. A change under `tests/evals/` runs the gate live even when the model sees
  nothing new; know that before touching the runner's fixtures.
- **The Content Security Policy is a control, not a setting.**
- **Check what is listening before trusting a red or green e2e run.** `lsof -iTCP:3000`.
- **The denylist can fire on ordinary vocabulary and on any address-shaped string** at
  any domain but `example.com` and `.invalid`. Remove the word rather than bypass the
  hook, and do not name it in the commit.
- **A refused commit leaves its files staged.** Read `git status` before every commit.
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

- **No Guardian prompt for session 14.** The scope was written by the instance that
  built it, after verifying the premises against the repository. Every premise held,
  which is what that buys and also why the record is weaker: nothing could be found
  false because nothing was written before looking.
- **The forwardable block has been forwarded by nobody**, and its two non-structural
  constraint tests are word lists over four fixed strings.
- **The session-to-PR map above sessions 1 to 13** was verified this session by count
  and by the closed-without-merging set, not by re-reading each PR.
- **The calendar file has not been opened by Mail, Calendar, Outlook, or anything else.**
  A fixture that exercises every escape is still owed.
- **The 1.4.0 rule was written for a sentence nobody saw.**
- **No pre-event email has been sent to anyone.**
- **No real photograph and no real site map has been through the resize**, and no phone
  has run this build. EXIF orientation through `createImageBitmap` on iOS is unobserved.
- **The PDF has been looked at as a rasterised page on one machine** and never printed.
- **The library has never held real approved copy.** Still the first check owed.
- **The migration tests run the upgrade functions over fake rows**, not Dexie's own
  upgrade transaction against IndexedDB.
- **The eval figures are one held-out run, one day.**
- **The containment amendment of 2026-09-09 is not reproduced here.** Its full text is in
  the handoff at commit `2dbdcb1` and in `fieldnote-loh`'s notes; its conclusions stand.
- **The hardware run is one phone, one day, iOS 26.6.1.** Nothing built in sessions 5 to
  14 has been run on hardware.
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
