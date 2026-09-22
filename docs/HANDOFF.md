# Handoff

Written 2026-09-22, at the head of `docs/session-21-deployed`, the second of session
21's two branches, for the state `main` will be in when it merges. `main` is at
`697066c`, which already carries session 21's first branch; this one adds the record.

Every claim here was checked against the repository, git history, the trackers, the
GitHub API, or the running deployment in the session that wrote it. Where something
could not be verified, it says so rather than smoothing over the gap. Nothing in this
document names the private repository, its Vercel project, or any deployment URL or
domain; that is the session's ground rule and not an omission.

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
RFC 2606 reserves. Since 2026-09-21 the private build exists as a separate private
repository, created from public `main` rather than forked, carrying real configuration
and deployed for the representative. It is never published. ADR-0001 is the record and
ADR-0012 is the deployment.

**Governance is load-bearing, not decorative.** The compliance architecture is
production code held to the same standard as any feature. A control is expected to be
*enforced*, not asserted: the denylist runs in a pre-commit hook and in CI; the
data-access boundary, the single-egress claim, the one-model-call rule, the draft state
machine, the no-draft-without-its-record invariant, the rule that a contact never reaches
the generation layer, the three job names branch protection depends on, and the caller
key on the generation route are failing tests; the security headers are asserted against
a live response and, since this session, verified against the running deployment; the
adversarial suite runs against the live model and fails the build if a violation reaches
a draft; claim-bearing text is selected from the library or blocked, never authored; and
where a control cannot be enforced the documentation says so plainly.
`docs/THREAT-MODEL.md` says which is which, boundary by boundary;
`docs/DATA-PROTECTION.md` does the same for every minimisation decision. `CLAUDE.md`
carries the non-negotiable constraints.

---

## Where we've been

`main` is at `697066c` with 262 commits and 48 merged pull requests; this branch adds the
session 21 record. `CHANGELOG.md` is the record of what each session shipped and is not
repeated here. What follows is the map from session to pull request, with the
closed-not-merged ones named because a closed PR is easy to mistake for one that never
existed. Verified this session from `gh pr list --state all`: 54 pull requests, six
closed without merging (#3, #5, #26, #27, #35, #52).

- **Phase 0, session 1** — two direct commits (`989d459`, `d509dca`), then **#6**,
  **#7**, **#8**. Dependabot **#1**, **#2**, **#4** merged. **#3** and **#5** closed, not
  merged: #3 was the `eslint-config-next` 16 bump that issue #11 tracks as a migration.
- **Documentation** — **#9**, **#10**; **#14** added this document and its template;
  **#16**, **#17**, **#18**; **#24**, **#25**.
- **Session 2, data layer** — **#12**. **Beads** — **#13**.
- **Session 3, capture and offline** — **#15**.
- **Session 4, the privacy boundary** — **#19**; ADR-0006.
- **First device run** — **#20** to **#23**; the certificate authority and the hardware
  walk, **#28** to **#31**.
- **Session 5, generation** — **#32**; ADR-0007; the containment of the beads database
  (`docs/THREAT-MODEL.md` §5.5).
- **Between sessions 5 and 6** — **#33**, **#36**. Dependabot **#26**, **#27**, **#35**
  closed, not merged, each with the reason on it.
- **Session 6, audit log and review gate** — **#37**; ADR-0008. **Between 6 and 7** —
  **#38**. Dependabot **#34** merged.
- **Session 7, adversarial eval suite** — **#39**. **Between 7 and 8** — **#40**.
- **Session 8, roster import** — **#41**; ADR-0003 amended.
- **Session 10, ADR-0009, the attendee view, and the clinician field** — **#42**, merged
  after **#43**.
- **Session 9, the approved content library** — **#44**; schema v5, ADR-0008 amended.
- **Session 11, the briefing** — **#45**; ADR-0010, ADR-0004 amended, schema v6.
- **Session 12, the pre-event email, the location, and the site map** — **#46**;
  ADR-0011, schema v7.
- **Session 13, the calendar file, ruleset 1.4.0, and the eval artifact** — **#47**;
  schema v8.
- **Session 14, the invite feature** — **#48**; ADR-0002 amended, schema v9. Phase 3
  closed.
- **Session 15, the threat model** — **#49**. Phase 4 opened.
- **Session 16, the data protection assessment** — **#53**; ADR-0001 amended.
- **Dependabot, session 20** — **#50** and **#51** merged; **#52** closed, not merged,
  pointing at issue #11.
- **Session 20, the deployment decision and the route's caller controls** — **#54**;
  ADR-0012.
- **Session 21, the private repository, deployed** — **#55** for the code the deployment
  needed, and this branch for the record. ADR-0012 amended.

---

## Where we are

`main` is at `697066c`, CI green on it. No pull requests are open. Zero open Dependabot
alerts. This branch has not been pushed yet, so everything below about its checks is
from local runs.

**The private build is deployed.** As of 2026-09-21, from a private repository created
from public `main` rather than forked — no fork relationship exists to follow — with no
other collaborators and GitHub Actions disabled on it, because the public repository
runs the tests and that one is a deployment source. Its Vercel project is configured as
ADR-0012 says. The representative reached it from her own phone, installed from the
production domain, with no machine of the owner's running.

**What was verified against the running deployment**, from outside it, on 2026-09-21 and
2026-09-22:

- Every security header on the document and on the route, `X-Robots-Tag: noindex,
  nofollow` included, and `robots.txt` disallowing everything.
- `/sw.js` served as JavaScript and `/precache.json` as JSON with thirty same-origin
  entries. That is `fieldnote-6x5`, closed: the silent failure it described did not
  happen on a real build.
- The route refusing a non-JSON content type with 415 and an unknown caller with 401.
  The 401's wording is the tell that the access hashes reached Production.
- The generated production URL and the branch URL both redirecting to a Vercel login.
  **No preview deployment exists, so the preview case is untested rather than passed.**
- The private-term rule reporting loaded, from the environment, with the expected count.

**What the device showed**, iOS 26.6.2: storage reported persistent; capture, drafting,
and the review gate worked; the offline shell held, with the event and note present after
the app was killed in airplane mode and a new note saved; and the access cookie survived
a relaunch, so the key is entered once.

**What the green checks mean.** `Verify` runs the denylist, lint, typecheck, unit tests
(364), build, and the end-to-end suite (44). `Adversarial guardrail suite` skipped on
both of this session's branches: nothing under a watched path changed, which is why the
private-term resolver sits where it does. The caveats:

- **The eval figures are one held-out run at five samples per case**, dated 2026-09-15
  under ruleset 1.4.0. Prompt and ruleset are untouched since.
- **The injection measurement is two payloads and one canary.**
- **The forwardable block has been forwarded by nobody.**
- **The calendar file has been opened by no calendar application.**
- **The pre-event email has never been sent to anyone.**
- **No real photograph and no real site map has been through the resize.**
- **The PDF library is unmaintained** by decision (ADR-0010).
- **The library has never held real approved copy**, so every draft on the device came
  back with gap markers, which is the empty library working.
- **The single-egress check is a grep**, and does not see the settings form post.
- **SRI is partial** (`fieldnote-9gp`); **CI enforces structural denylist patterns
  only**; **the end-to-end suite runs in one browser**; **the service worker's update
  path is untested** (`fieldnote-unp`).
- **The required-checks tripwire sees the code side only.**
- **The event name and the approved passages cross outside the note delimiter**
  (`fieldnote-3rl`).
- **`persistence.spec.ts:92` is intermittent** (`fieldnote-ccf`). It passed in this
  session's full runs.
- **Nothing in the repository verifies any platform setting.** Deployment protection,
  the toolbar switches, the environment scoping of all three variables, the spend limit,
  and the device's auto-lock are all settings elsewhere. `vercel.json` carries the
  region; the rest is a hand check each session.
- **The private term list is untestable in public by construction** (new). The mechanism
  and the passage exemption are tested with synthetic terms; whether the real list is
  complete or current is knowable only where it lives.

**ADR-0012 is amended**, 2026-09-22, with five facts the real platform settled: the
Speed Insights collection route ships whether or not the product is enabled, while
nothing on the page loads it; the cookie survives on iOS; persistent storage is granted;
the precache survives a Vercel build; and she installs from the production domain.

**Schema is at v9**, unchanged, and deliberately: neither the caller key nor the storage
line needed a field.

**Versions.** Prompt template 1.2.0; guardrail ruleset 1.4.0. Neither changed.

**Documentation set.** `README.md`, `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`
(session 21 amended on completion), `docs/TESTING-ON-DEVICE.md`,
`docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, twelve ADRs with an index and
`CLAUDE.md`'s list complete, `docs/prompts/` through session 21, this handoff and its
template, `CHANGELOG.md`, `SECURITY.md`. Plan §4.6's `docs/ARCHITECTURE.md`,
`docs/AI-SYSTEM-CARD.md`, and `docs/COMPLIANCE-MAP.md` do not exist yet.

---

## What's next

Two sessions are ready and independent of each other.

### Session 17 — Compliance map

Controls mapped to NIST AI RMF, the EU AI Act, and ISO/IEC 42001; precise about the risk
tier rather than expansive; ADR-0004's seam mapped as a seam. ~3 hours, no bead, the
guide's entry is the scope. It draws on the threat model's §3 and §6, the assessment
throughout, and now ADR-0012 for hosting and the caller key. The provider's retention is
settled and is not zero: map the standard commercial policy, deleted within 30 days and
up to 2 years for flagged content, not a zero-retention arrangement.

### Session 22 — Retention, implemented

`fieldnote-iox`, as the owner decided it on 2026-09-17: automatic deletion 30 days after
the event ends, a notice from day 23, her own delete at any time, audit records kept, the
period a build-time constant. A test for each rule, the ADR the decision still needs, and
ADR-0004's retention consequence pointed at it. ~3 hours.

### Owner actions owed, none of which this repository can verify

- **The Vercel project's settings**, as a standing hand check: protection scope and
  method, all three variables scoped to Production, analytics and the toolbar off.

Done and unverifiable from here: the spend limit on the model API key, set 2026-09-21 on
a workspace dedicated to this deployment and replaced along with the key on 2026-09-22
after the key had not reached Production; and automatic screen lock on the
representative's device, 2026-09-21 (`docs/THREAT-MODEL.md` §5.6).

Still owed and unchanged: a real photo and a real site map through the resize; the real
approved content loaded, which is now the first thing the deployment is waiting for; a
calendar application opening the `.ics`; a forwarded block read in a second mail client;
and the rest of `fieldnote-bdw` — the seven idle days and real storage pressure.

Check the prompt's premises against the repository before building on them, and stop
when one is wrong. `docs/prompts/session-21.md` records where this session's stopped and
why.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session, by doing, before the first
tracker write and after the last: the tracker's data stays on this machine. 74 issues: 30
open, 43 closed, 1 blocked, 29 ready (`bd stats`).

Closed this session: `fieldnote-6x5`, the precache on a real build; `fieldnote-ijg`, the
deployment; `fieldnote-v2s`, the private fork's missing session; `fieldnote-cjs`, moot on
a deployment with no proxy in front of it. Appended: `fieldnote-bdw`, with the second
device observation. Opened: `fieldnote-cno`, the two interface findings from the device
check, recorded rather than fixed on the owner's instruction. Still open and
load-bearing: `fieldnote-iox` — retention, session 22; `fieldnote-bdw` — the seven-day
window and storage pressure, now the whole of it; `fieldnote-jqk` and `fieldnote-cdx` —
the two deletion limits, owner decisions; `fieldnote-52s`, `fieldnote-5ow` — the cascade
test and the records naming three tables; `fieldnote-8w6`, `fieldnote-ap1` — where
dictation runs and whether the store is backed up; `fieldnote-3rl` — the fields outside
the note delimiter; `fieldnote-bn0`, `fieldnote-ccf`, `fieldnote-9gp`, `fieldnote-unp`,
`fieldnote-ech`, `fieldnote-dx0`, `fieldnote-oa9`, `fieldnote-ao9`, `fieldnote-tg4`, and
the rest of the backlog, unchanged.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.

**Session prompts — what was asked.** `docs/prompts/`, one file per session from 3
through 16, plus 20 and 21.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once
accepted, superseded or amended with a dated note. One amended this session: ADR-0012,
2026-09-22. Still owed: the retention ADR (`fieldnote-iox`); ADR-0004's availability
amendment when `fieldnote-bdw` resolves; ADR-0008's dated note on the cascade
(`fieldnote-5ow`); the three stale "session 15" pointers (`fieldnote-oa9`); ADR-0006's
five-name evidence statement; and the decision `fieldnote-af9` holds.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.**
- **Verify the premises before building on them, and stop when one is wrong** —
  including a premise the tracker carries: a bead is a claim, not a source.
- **Check the watched paths before writing code, not after.** A change under
  `src/lib/generation/` or `src/lib/privacy/` makes the adversarial suite call the live
  model. Twice now a design has been reshaped to avoid it; both times the reshaped
  version was defensible on its own terms, and both times the file says so.
- **A platform's defaults are a claim to check.** The deployment answers on an analytics
  route nobody enabled. Nothing collects, but nothing in the repository would have
  predicted it either.
- **A live weakness not already in a bead goes to the owner in the session.**
- **A dependency gets an ADR before it is installed.**
- **A control that is not tested is not a control, and one that reads as tested is
  worse.**
- **Verify by running, not by reasoning.**
- **`pnpm evals` costs real spend.**
- **The Content Security Policy is a control, not a setting.**
- **Check what is listening before trusting a red or green e2e run.** `lsof -iTCP:3000`.
  One full-suite failure of `persistence.spec.ts:92` alone is `fieldnote-ccf`, not a
  regression; anything else red is.
- **Dependabot branches go stale**, and protection requires up-to-date branches. Update,
  then re-read the diff, because an update is a chance for the lockfile to change.
- **Verify a pinned action rather than trusting the bump.**
- **The denylist can fire on ordinary vocabulary and on any address-shaped string.**
- **A refused commit leaves its files staged.** Read `git status` before every commit.
- **The constraints in `CLAUDE.md` are not optional.**
- **A finding about the private material is not written into any location the repository
  controls**, and nor is the private repository's name, its project, or any deployment
  URL or domain.
- **Never `--no-verify`.** Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks, including every `bd` command.
- **`bd update --notes` replaces the field; `--append-notes` appends.**
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** Prettier reformats committed files, so read the wrapped text
  before anchoring an edit on it. Markdown is excluded from Prettier and hand-wrapped.
- **One session, one PR**, except where a session must ship code before it can do the
  rest, as this one did.
- **Separate commits per logical change.** Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **This branch has not been pushed and has no CI run.**
- **The deployment has been used by one person, on one phone, on one day.** Everything
  in *Where we are* about it is that.
- **No preview deployment exists**, so preview protection is untested.
- **The real approved content has still never been loaded**, so no draft has ever
  carried a real passage, on the device or anywhere.
- **The private term list is four terms the working instance never saw.** That the rule
  loaded with a count of four is the whole of what is known about it here.
- **Nothing in the repository verifies any platform setting or the spend limit.**
- **The model key not reaching Production was found by a person drafting on a phone**,
  not by anything here. The access hashes announce their absence through the route's
  401 wording; the model key does not announce itself until someone with a valid key
  drafts.
- **`fieldnote-cno`'s two findings are recorded and not fixed**, on the owner's
  instruction.
- **The threat model's severities are one reader's judgement.**
- **The required-checks test sees the code side only.**
- **`core.hooksPath` cannot be asserted in CI.**
- **The single-egress tightening scheduled for session 15 was not built**
  (`fieldnote-oa9`).
- **The session-to-PR map above sessions 1 to 20** was verified by count and by the
  closed-without-merging set, not by re-reading each PR.
- **The migration tests run the upgrade functions over fake rows.**
- **The eval figures are one held-out run, one day.**
- **The containment amendment of 2026-09-09 is not reproduced here.**
- **The seven-day eviction window and real storage pressure are unobserved.**
- **Where the platform's dictation runs, and whether the store is in a backup, are
  unrecorded.**
- **Audit records grow without bound** by design, and retention is decided and not built.
- **A name with neither a title nor a roster entry is still missed.**
- **Hours in the build guide are estimates, not measurements.**

---

## How to use this

**Regenerate, do not edit.** Write each handoff by re-reading the sources — `git log`,
the build guide, `CLAUDE.md`, `docs/adr/README.md`, `bd ready`, `bd blocked`, and the
open GitHub issues.

**Point, do not copy.** Anything with a canonical home gets a pointer.

**Every claim traceable.** To a file, a commit, or a command run while writing. If it is
not, say so in *Known gaps* rather than dropping it silently or asserting it anyway.
