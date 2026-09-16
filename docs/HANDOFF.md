# Handoff

Written 2026-09-16, at the head of `docs/session-15-threat-model`, the session 15 branch
as amended after the owner's review, for the state `main` will be in when it merges.
`main` is at `f05ca82`; the branch adds seven commits including this one.

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
enters, with a calendar file beside it and, when she turns it on for an event, a part the
recipient can pass on to a colleague. Full detail in `docs/PROJECT-PLAN.md`; `README.md`
is the public front door; this section is orientation only.

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
machine, the no-draft-without-its-record invariant, the rule that a contact never reaches
the generation layer, and — since session 15 — the three job names branch protection
depends on are failing tests; the security headers are asserted against a live response;
the adversarial suite runs against the live model and fails the build if a violation
reaches a draft; a roster import, a briefing download, and a composed pre-event email are
each shown to make no network request; claim-bearing text is selected from the library or
blocked, never authored; and where a control cannot be enforced the documentation says
so plainly. `docs/THREAT-MODEL.md` now says which is which, boundary by boundary.
`CLAUDE.md` carries the non-negotiable constraints.

---

## Where we've been

`main` is at `f05ca82` with 229 commits and 42 merged pull requests; this branch adds
seven commits. `CHANGELOG.md` is the record of what each session shipped, from session 2
onward, and is not repeated here. What follows is the map from session to pull request,
with the closed-not-merged ones named because a closed PR is easy to mistake for one that
never existed. Verified this session from `gh pr list --state all`: 48 numbers, one of
them (#11) an issue, five closed without merging.

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
  (see *Known gaps*, and now `docs/THREAT-MODEL.md` §5.5).
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
- **Session 14, the invite feature** — **#48**; ADR-0002 amended, schema v9. Phase 3
  closed.
- **Session 15, the threat model** — this PR. `docs/THREAT-MODEL.md`, and one control,
  `tests/unit/required-checks.test.ts`. Phase 4 opens.

---

## Where we are

`main` is at `f05ca82`, CI green. No pull requests are open besides this one. Zero open
Dependabot alerts.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, force pushes and deletions disabled, and
signed commits not required. Required approving reviews: **0**, deliberate for a
single-maintainer repository. Verified this session against the classic
branch-protection API; the repository has no rulesets (`gh api repos/…/rulesets` is
empty). Since this session, `tests/unit/required-checks.test.ts` asserts that the three
workflows render exactly those three job names, so a rename fails `Verify` on the pull
request that makes it. The settings side is still a hand check, and the test's header
says so.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (318), build, and the end-to-end suite (37). `Adversarial guardrail suite`
skips the model on this PR: nothing under a watched path changes, and the new test's
directory was read against `scripts/evals-watched-paths.mjs` before the test was
written. On a PR that touches a watched path it runs live and says so. The caveats,
unchanged from session 14 except where marked:

- **The eval figures are one held-out run at five samples per case**, in `README.md`,
  dated 2026-09-15 under ruleset 1.4.0, every row held out. 0 of 70 reached, 4 of 70
  produced. Nothing in this session changes them: prompt and ruleset are untouched.
- **The injection measurement is two payloads and one canary** (new, stated). 0 of 10
  produced on the held-out run; an obeyed instruction that writes no canary is counted by
  nothing. `docs/THREAT-MODEL.md` §4.
- **The forwardable block has been forwarded by nobody**, and two of its five constraint
  tests are word lists over four fixed strings.
- **The sentence that motivated 1.4.0 was never seen.** The next failure will have its
  text: CI keeps the results file.
- **The calendar file has been opened by no calendar application.**
- **The pre-event email has never been sent to anyone.**
- **No real photograph and no real site map has been through the resize.**
- **The PDF library is unmaintained** by decision (ADR-0010).
- **The library has never held real approved copy.**
- **Each "no network request" claim is one recorded run** on fixtures.
- **The single-egress check is a grep**; **SRI is partial** (`fieldnote-9gp`); **CI
  enforces structural denylist patterns only**; **the end-to-end suite runs in one
  browser**; **the service worker's update path is untested** (`fieldnote-unp`). All
  four are now in `docs/THREAT-MODEL.md` §6 with their beads, which is where sessions 16
  and 17 cite them from.
- **The required-checks tripwire sees the code side only** (new). If the required
  contexts change in GitHub's settings, the strings in the test are wrong and nothing in
  the repository says so.
- **The event name and the approved passages cross the boundary outside the note
  delimiter** (new). Wrapping them is a prompt-template change for a later session.
  `fieldnote-3rl`; `docs/THREAT-MODEL.md` §4.
- **What the provider retains of the pseudonymized request is an account arrangement
  nobody has verified** (new). `fieldnote-n9l`; session 17 depends on the answer.

**Plan §4.6's `docs/THREAT-MODEL.md` exists; Phase 4 opens.** What is protected and from
whom; four boundaries with a text diagram; STRIDE per boundary with every control naming
the file that enforces it or saying it is documented only; injection through dictated
input as the first-class entry; six worked entries from their beads; residual risk in
one section. The beads publication of 2026-09-09 is §5.5, written under the `CLAUDE.md`
agreement on the private material: the entry says a term held out of the public
documents was exposed for a day and that a history the project does not control retains
it, and nothing more.

**Schema is at v9.** Unchanged this session.

**Versions.** Prompt template 1.2.0; guardrail ruleset 1.4.0; both recorded on every
audit record. Neither changed this session.

**Documentation set.** `README.md` (eval table from session 13's run),
`docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md` (session 15 amended on completion),
`docs/TESTING-ON-DEVICE.md`, `docs/THREAT-MODEL.md` (new), eleven ADRs with an index and
`CLAUDE.md`'s list complete, `docs/prompts/` through session 15, this handoff and its
template, `CHANGELOG.md` through session 15, `SECURITY.md`. Plan §4.6's
`docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`, `docs/DATA-PROTECTION.md`, and
`docs/COMPLIANCE-MAP.md` do not exist yet (checked with `ls docs`); the threat model's
§6 ends with a paragraph on what each will need from it.

---

## What's next

### Session 16 — Data protection assessment

The guide's entry: data inventory, flow diagrams, minimisation rationale, retention —
and retention is not a documentation item, because ADR-0004 leans on a small local
store as a mitigation, so it has to be real implemented behaviour, decided **before** the
session and not during it. Budgeted at ~3 hours. The bead is `fieldnote-d7d`, deferred
and blocked on `fieldnote-tcq`, the retention decision, which is the owner's and is
itself blocked on `fieldnote-bdw`, Safari's eviction window, because retention cannot be
decided sensibly without knowing which of the two deletes first on the target platform.
Read the guide's entry in full; the bead exists to hang dependencies from and does not
repeat it. `docs/THREAT-MODEL.md` §6 is the residual-risk list the assessment cites, and
§2 and §3.3 are its inventory of what crosses the one egress.

Still owed and unchanged: a real photo and a real site map through the resize on the
device; the real approved content loaded in the private fork; a calendar application
opening the `.ics`; a forwarded block read in a second mail client; and the device
check `fieldnote-bdw` describes, which now gates two sessions.

Either way: check the prompt's premises against the repository — including whether the
previous PR has merged — before building on them. Session 15's prompt was drafted by
the session 14 instance and rewritten by Guardian; `docs/prompts/session-15.md` says
which premises held and which bent.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session, by doing: the tracker's data
stays on this machine. 63 issues: 26 open, 35 closed, 2 deferred, 22 ready, 4 blocked
(`bd stats`; `bd ready` counts 23, and the two commands have disagreed by one since
session 13). Run `bd ready` and `bd blocked`.

Named here because they qualify claims made above; the backlog itself is not listed.
Closed this session: `fieldnote-loh`, the session's own bead, and the seven that were
blocked on it — `fieldnote-pce`, `fieldnote-7j1`, `fieldnote-awv`, `fieldnote-8av`,
`fieldnote-rrv`, `fieldnote-vmj`, `fieldnote-m8t` — each with a close reason naming its
entry. `fieldnote-tcq` — retention, the owner's decision before session 16.
`fieldnote-d7d` — session 16, deferred. `fieldnote-ech` and `fieldnote-dx0` — their
threat-model entries are written (§4) and both stay open, because each also carries work
this session did not own; whether to close them is the owner's call. `fieldnote-ay2` —
over-blocking, 34 of 70 by decision. `fieldnote-af9` — the post-event readout, not
decided. `fieldnote-g7d` — open for that decision. `fieldnote-ao9` — the library body's
encryption class. `fieldnote-quj` — the two rulesets differ. `fieldnote-m28` — history
joined by name. `fieldnote-6qr` — a workbook with several sheets. `fieldnote-5iv` — the
edit-distance dashboard. `fieldnote-9gp` — SRI. `fieldnote-bdw` — Safari storage
durability. `fieldnote-unp` — the service worker update path. `fieldnote-v2s` — the
private fork has no session. `fieldnote-6x5`, `fieldnote-ijg` — nothing is deployed.
Opened in the amendment after review, 2026-09-16: `fieldnote-3rl` — the event name and
the passages cross outside the note delimiter; `fieldnote-9n1` — the controls the
generation route needs before any hosted origin, blocking `fieldnote-ijg`;
`fieldnote-n9l` — the provider's zero-retention arrangement, unverified; `fieldnote-oa9`
— three documents point at session 15 for a tightening it did not do; `fieldnote-bn0` —
clipboard exposure after export, not modelled.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.

**Session prompts — what was asked.** `docs/prompts/`, one file per session from 3
through 15. Session 14's was written in-session; session 15's was drafted by the session
14 instance and rewritten by Guardian, and the file says so.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once accepted,
superseded or amended with a dated note. None amended this session: nothing in the
threat model changes a decision. Still owed or worth considering: ADR-0004 again when
`fieldnote-bdw` resolves; ADR-0005, the build guide's session 5 entry, and the header of
`tests/unit/single-egress.test.ts` each say the single-egress grep is revisited in
session 15, and it was documented rather than tightened (threat model §6), so the three
pointers are stale (`fieldnote-oa9`); ADR-0006's five-name evidence statement; the plan
§2 conversation; and the decision `fieldnote-af9` holds.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong** — including "on `main` after PR #N".
- **A prompt written in-session is a weaker record than one written before contact with
  the repository.** It happened once, in session 14, with the gap named; it is not the
  pattern.
- **A live weakness not already in a bead goes to the owner in the session, and nowhere
  the repository controls.** A public repository gets a threat model, not a disclosure;
  the owner decides whether and where it is recorded.
- **A dependency gets an ADR before it is installed**; a file format that is stable and
  small is written by hand and tested against its RFC.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself.
- **Verify by running, not by reasoning.** A browser's locale data and Node's are not
  the same; a controlled input does not flip until its record does.
- **`pnpm evals` costs real spend.** Run it deliberately, count the runs, and report the
  total. A change under `tests/evals/` runs the gate live even when the model sees
  nothing new; read `scripts/evals-watched-paths.mjs` before adding a test anywhere near
  it.
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
- **`bd close` refuses a bead blocked on an open one.** Close the blocker first, or the
  order a prompt prescribes will not be the order the tracker allows.
- **`bd update --notes` replaces the field.** Read the existing notes first.
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** Prettier reformats committed files, so read the wrapped text
  before anchoring an edit on it. Markdown is excluded from Prettier and hand-wrapped.
- **One session, one PR.** Findings that are not blocking get beads.
- **Separate commits per logical change.** An ADR and its consequences come before any
  code that depends on them. Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **The threat model has been read by nobody but the instance that wrote it.** Its
  severities are one reader's judgement, and its empty STRIDE cells are the ones that
  reader could not fill honestly, not proof that nothing belongs there.
- **The required-checks test sees the code side only.** The required contexts live in
  GitHub's settings and are verified by hand, this session and each one after.
- **`core.hooksPath` cannot be asserted in CI.** Local configuration; the check is a
  line in the pre-commit hook's comment and a habit.
- **The injection entry's "likely to be withheld" is a reading of the guard, not a
  measurement.** No corpus case has a role-shaped sign-off.
- **The single-egress tightening scheduled for session 15 was not built**, by the
  prompt's scope guard; three documents still point at session 15 for it
  (`fieldnote-oa9`).
- **The forwardable block has been forwarded by nobody**, and its two non-structural
  constraint tests are word lists over four fixed strings.
- **The session-to-PR map above sessions 1 to 14** was verified this session by count
  and by the closed-without-merging set, not by re-reading each PR.
- **The calendar file has not been opened by Mail, Calendar, Outlook, or anything else.**
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
  the handoff at commit `2dbdcb1` and in `fieldnote-loh`'s notes; the threat model's §5.5
  is deliberately less specific than either, and its conclusions stand.
- **The hardware run is one phone, one day, iOS 26.6.1.** Nothing built in sessions 5 to
  15 has been run on hardware.
- **The layout validation is one observed session**; nothing built since has been
  observed in use.
- **Storage durability across Safari's eviction window is untested.** `fieldnote-bdw`,
  and it now gates the retention decision and session 16.
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
