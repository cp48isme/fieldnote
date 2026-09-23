# Handoff

Written 2026-09-23, at the head of `feat/session-22-retention`, for the state `main`
will be in when it merges. `main` is at `2aa1d42`.

Every claim here was checked against the repository, git history, the trackers, the
GitHub API, or the running deployment in the session that wrote it. Where something
could not be verified, it says so rather than smoothing over the gap. Nothing in this
document names the private repository, its Vercel project, or any deployment URL or
domain; that is the session's ground rule and not an omission.

Regenerate this document from `docs/HANDOFF-TEMPLATE.md` at the end of each session, by
re-reading the sources. Do not edit the previous handoff in place — a handoff written
from the last handoff drifts from the repository it describes. The previous version was
edited in place rather than regenerated, and by the time this one was written it
described `main` two merges behind, reported no open pull requests while one was open,
and still listed the retention ADR as owed after the session had written it. That is the
drift the rule exists to prevent, and it is why this one was written from the template
with the previous version closed.

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
the generation layer, the three job names branch protection depends on, the caller key on
the generation route, and now the retention rule are failing tests; the security headers
are asserted against a live response and against the running deployment; the adversarial
suite runs against the live model and fails the build if a violation reaches a draft;
claim-bearing text is selected from the library or blocked, never authored; and where a
control cannot be enforced the documentation says so plainly. `docs/THREAT-MODEL.md` says
which is which, boundary by boundary; `docs/DATA-PROTECTION.md` does the same for every
minimisation decision. `CLAUDE.md` carries the non-negotiable constraints.

---

## Where we've been

`main` is at `2aa1d42` with 266 commits and 50 merged pull requests; this branch adds
session 22. `CHANGELOG.md` is the record of what each session shipped and is not repeated
here. What follows is the map from session to pull request, with the closed-not-merged
ones named because a closed PR is easy to mistake for one that never existed. Verified
this session from the GitHub API: 57 pull requests, 50 merged, one open (**#58**, this
branch), six closed without merging (#3, #5, #26, #27, #35, #52).

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
  needed, **#56** for the record. ADR-0012 amended.
- **Session 23, the device findings** — **#57**, 2026-09-22. ADR-0012 amended again;
  `fieldnote-cno` closed. Out of numerical order because the device findings had to reach
  the representative before retention did.
- **Session 22, retention implemented** — **#58**, this branch. ADR-0013 added; ADR-0004
  amended; `fieldnote-iox` closed.

---

## Where we are

`main` is at `2aa1d42`, CI green on it. One pull request is open: **#58**, this branch,
with all four checks passing — `Verify`, `Adversarial guardrail suite`, `Analyze
(javascript-typescript)`, and `CodeQL`. Zero open Dependabot alerts and zero open
Dependabot pull requests. Branch protection on `main` requires the three contexts,
requires branches to be up to date, and applies to administrators; it requires no
approving review.

**Retention is built.** An event's content — attendees, notes, drafts, contacts, images,
and the event itself — is deleted fourteen days after the event ends, with a notice on
the event from day seven stating the date. The clock keys on `endsAt`, falling back to
`startsAt` and then to `updatedAt`. The sweep runs on load rather than on a timer,
because an installed application is not running when it is closed, and it reuses
`deleteEvent`, so retention and a delete by hand share one cascade. Nothing is stored to
make it work, so the schema did not move. ADR-0013 is the record and
`src/lib/db/retention.ts` is the rule.

**The periods were set late, on 2026-09-23**, by the owner, after this branch's checks
were green and before it merged: fourteen days rather than the thirty the work was built
against, with the notice keeping its seven-day shape. The reasoning is in ADR-0013 under
*Why fourteen days*, and thirty days and seven days are both written up there as
considered. The change cost two constants and the prose quoting them. No logic moved,
because the rule reads the constants and the notice is written as a gap subtracted from
the period rather than as a day number — which is what writing it that way was for.

**The private build is deployed.** As of 2026-09-21, from a private repository created
from public `main` rather than forked — no fork relationship exists to follow — with no
other collaborators and GitHub Actions disabled on it, because the public repository
runs the tests and that one is a deployment source. Its Vercel project is configured as
ADR-0012 says. The representative reached it from her own phone, installed from the
production domain, with no machine of the owner's running. **The private repository is
synced to `main` as of session 23's merge; this session's merge is not on it yet, and
the sync that puts it there is a production deploy.**

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

**What the device showed**, iOS 26.6.2, 2026-09-21: storage reported persistent; capture,
drafting, and the review gate worked; the offline shell held, with the event and note
present after the app was killed in airplane mode and a new note saved; and the access
cookie survived a relaunch, so the key is entered once.

**What the green checks mean.** `Verify` runs the denylist, lint, typecheck, unit tests
(385), build, and the end-to-end suite (52). `Adversarial guardrail suite` skipped the
model on this branch: nothing under a watched path changed, which is why the private-term
resolver sits where it does. The caveats:

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
- **The private term list is untestable in public by construction.** The mechanism and
  the passage exemption are tested with synthetic terms; whether the real list is
  complete or current is knowable only where it lives.
- **No test asserts what the retention periods are in the private fork.** They are
  build-time constants there as here, and that fork is where they may differ.

**From session 23, on `main` since 2026-09-22.** The Device link no longer waits for an
event, so a fresh install can authorise itself; every outcome of the access form returns
to the settings screen and says what happened; and the screen states plainly that it
cannot check later whether a key is stored. `fieldnote-cno` is closed. One palette,
light, always: the dark variant is removed rather than overridden, the background is a
warm cream, and `color-scheme: light` keeps the browser from rendering form controls dark
under it. Every pair was measured in a browser rather than reasoned about; three failed
and were darkened, and the control boundary went from 1.26:1 to 3.32:1.
`tests/e2e/theme.spec.ts` asserts the palette with the browser emulating dark. The
route's start-up line also reports whether the model key is present.

**ADR-0012 is amended**, 2026-09-22, with five facts the real platform settled: the
Speed Insights collection route ships whether or not the product is enabled, while
nothing on the page loads it; the cookie survives on iOS; persistent storage is granted;
the precache survives a Vercel build; and she installs from the production domain.

**Schema is at v9**, unchanged through four sessions, and deliberately: neither the
caller key, the storage line, the session 23 work, nor retention needed a field. Each
time the question was answered before any code.

**Versions.** Prompt template 1.2.0; guardrail ruleset 1.4.0. Neither changed.

**Documentation set.** `README.md`, `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`
(session 22 amended on completion), `docs/TESTING-ON-DEVICE.md`, `docs/THREAT-MODEL.md`,
`docs/DATA-PROTECTION.md`, thirteen ADRs with an index and `CLAUDE.md`'s list complete,
`docs/prompts/` for sessions 3 through 16 and 20 through 23, this handoff and its
template, `CHANGELOG.md`, `SECURITY.md`. Plan §4.6's `docs/ARCHITECTURE.md`,
`docs/AI-SYSTEM-CARD.md`, and `docs/COMPLIANCE-MAP.md` do not exist yet.

---

## What's next

### Session 17 — Compliance map

Controls mapped to NIST AI RMF, the EU AI Act, and ISO/IEC 42001; precise about the risk
tier rather than expansive; ADR-0004's seam mapped as a seam. ~3 hours, no bead, the
guide's entry is the scope. Read that entry in full before writing prompts for it. It
draws on the threat model's §3 and §6, the assessment throughout, ADR-0012 for hosting
and the caller key, and now ADR-0013 for retention. The provider's retention is settled
and is not zero: map the standard commercial policy, deleted within 30 days and up to 2
years for flagged content, not a zero-retention arrangement. Do not run it together with
the local store's fourteen days; they are different periods held by different parties.

It is the only guide session that is ready and unblocked. Sessions 18 and 19 sit behind
owner decisions and the private fork respectively.

### Owner actions owed, none of which this repository can verify

- **The Vercel project's settings**, as a standing hand check: protection scope and
  method, all three variables scoped to Production, analytics and the toolbar off.
- **Session 23's two outstanding checks, never answered.** The start-up line after that
  deploy, where `modelKey` should read `present`; and the phone walk of the reachable
  Device link, the access form's three outcomes, and the cream palette on the device.
  Both were asked for at the end of session 23 and neither came back, so nothing here
  knows how that deploy behaved.

Done and unverifiable from here: the **spend limit** on the model API key was set on
2026-09-21 and was **not** replaced. What was replaced, on 2026-09-22, was the **model
key**, within the same capped workspace, after the original had not reached Production.
Session 21's handoff ran the two together; this is the correction. Also done: automatic
screen lock on the representative's device, 2026-09-21 (`docs/THREAT-MODEL.md` §5.6).

Still owed and unchanged: a real photo and a real site map through the resize; the real
approved content loaded, which is the first thing the deployment is waiting for; a
calendar application opening the `.ics`; a forwarded block read in a second mail client;
and the rest of `fieldnote-bdw` — the seven idle days and real storage pressure.

Check the prompt's premises against the repository before building on them, and stop
when one is wrong. `docs/prompts/session-22.md` records where this session's stopped and
why — the prompt arrived truncated mid-part — and what changed after the checks were
green.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session, by doing, before the first
tracker write and after the last: `backup.git-push` is false, `git ls-remote origin
'refs/dolt/*'` returns nothing, and `core.hooksPath` still reads `.husky/_`. The
tracker's data stays on this machine. 74 issues: 28 open, 45 closed, 1 blocked, 27 ready
(`bd stats`). Use `bd ready` and `bd blocked`; the backlog is not copied here.

Closed this session: `fieldnote-iox`, the retention policy, with the implementation and
its tests named on the close. Appended to afterwards, when the period changed: a close
reason cannot be edited, and that one quotes the thirty-day figure and the pre-change
test names. Still open and load-bearing, each named only because a claim above leans on
it: `fieldnote-bdw` — the seven-day eviction window and storage pressure; `fieldnote-jqk`
and `fieldnote-cdx` — the two deletion limits, owner decisions that retention neither
fixes nor worsens; `fieldnote-52s` and `fieldnote-5ow` — the cascade test and the records
naming three tables; `fieldnote-8w6` and `fieldnote-ap1` — where dictation runs and
whether the store is backed up; `fieldnote-3rl` — the fields outside the note delimiter;
`fieldnote-ccf` — the intermittent persistence spec; `fieldnote-9gp` and `fieldnote-unp`
— partial SRI and the untested service-worker update; `fieldnote-oa9` — the single-egress
tightening and the stale session-15 pointers. One issue is blocked: `fieldnote-ao9`,
behind `fieldnote-8pl`.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.
It is stuck on what it has always been stuck on: `eslint-config-next` 16 requires flat
config, and three Dependabot pull requests have been closed pointing at it.

**Session prompts — what was asked.** `docs/prompts/`, one file per session from 3
through 16, plus 20 through 23. Each carries the prompt as sent and a *how it actually
went* section written on completion.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once
accepted, superseded or amended with a dated note. This session added **ADR-0013**,
retention of the local store, and amended **ADR-0004**, 2026-09-23, so its *Residual
risk* points at a built policy rather than an assumed one. Still owed: ADR-0004's
availability amendment when `fieldnote-bdw` resolves; ADR-0008's dated note on the
cascade (`fieldnote-5ow`); the three stale "session 15" pointers (`fieldnote-oa9`);
ADR-0006's five-name evidence statement; and the decision `fieldnote-af9` holds.

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
- **`bd update --notes` replaces the field; `--append-notes` appends.** A close reason
  cannot be edited, so a decision that changes after a close goes on as an appended note.
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** Prettier reformats committed files, so read the wrapped text
  before anchoring an edit on it. Markdown is excluded from Prettier and hand-wrapped.
- **A number that governs behaviour is a named constant, and a derived number is
  derived.** The retention period moved from thirty days to fourteen after the work was
  finished and cost two lines of source, because the notice was held as a gap subtracted
  from the period rather than as a day number and the tests named the rule.
- **Every change that should reach the representative needs the private repository
  synced, and each sync is a production deploy.** Merging to public `main` changes
  nothing she can see. The private repository is fast-forwarded from `upstream/main` and
  pushed, which is what triggers the build; it must never diverge, so if a fast-forward
  is not possible, stop rather than merge. Plan the deploy as part of the session, not
  after it.
- **One session, one PR**, except where a session must ship code before it can do the
  rest, as session 21 did.
- **Separate commits per logical change.** Merge commit, not squash.
- **Regenerate this handoff; do not edit it.** The previous version was edited in place
  and was wrong about `main`, about the open pull request, and about which ADRs were
  owed.

---

## Known gaps in this document

Stated rather than smoothed over.

- **The deployment has been used by one person, on one phone, on one day.** Everything
  in *Where we are* about it is that.
- **Nothing here knows how the deploy of 2026-09-22 behaved.** Session 23's start-up line
  and phone checks were asked for and never answered, so the reachable Device link, the
  access form's three outcomes, and the cream palette are verified in a test browser and
  nowhere else.
- **No preview deployment exists**, so preview protection is untested.
- **The real approved content has still never been loaded**, so no draft has ever
  carried a real passage, on the device or anywhere.
- **The private term list is four terms the working instance never saw.** That the rule
  loaded with a count of four is the whole of what is known about it here.
- **Nothing in the repository verifies any platform setting or the spend limit.**
- **The model key not reaching Production was found by a person drafting on a phone**,
  not by anything here. Since session 23 the start-up line reports whether it is present,
  so the next occurrence shows in the logs; that is a report, not a test, and nothing
  fails if it reads absent.
- **Retention has never run on the device.** Everything known about it comes from unit
  tests and one browser: no event on the representative's phone has reached its date, and
  the first real deletion will happen there with nobody watching.
- **The threat model's severities are one reader's judgement.**
- **The required-checks test sees the code side only.**
- **`core.hooksPath` cannot be asserted in CI.**
- **The single-egress tightening scheduled for session 15 was not built**
  (`fieldnote-oa9`).
- **The session-to-PR map above, for sessions 1 to 20**, was verified by count and by the
  closed-without-merging set, not by re-reading each pull request.
- **The migration tests run the upgrade functions over fake rows.**
- **The eval figures are one held-out run, one day.**
- **The containment amendment of 2026-09-09 is not reproduced here.**
- **The seven-day eviction window and real storage pressure are unobserved.**
- **Where the platform's dictation runs, and whether the store is in a backup, are
  unrecorded.**
- **Audit records grow without bound** by design (ADR-0008). Retention bounds an event's
  content and not the records, so what is unbounded is the record table rather than the
  store as a whole.
- **Retention deletes on the first load after the date, not on the date.** A device left
  closed past a due date holds the content until it is next opened.
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
