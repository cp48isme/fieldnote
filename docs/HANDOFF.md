# Handoff

Written 2026-10-05, at the head of `docs/session-17-compliance-map`, for the state
`main` will be in when it merges. `main` is at `ce16360`.

Every claim here was checked against the repository, git history, the trackers, the
GitHub API, or the running deployment in the session that wrote it. Where something
could not be verified, it says so rather than smoothing over the gap. Nothing in this
document names the private repository, its Vercel project, or any deployment URL or
domain; that is the project's ground rule and not an omission.

Regenerate this document from `docs/HANDOFF-TEMPLATE.md` at the end of each session, by
re-reading the sources. Do not edit the previous handoff in place — a handoff written
from the last handoff drifts from the repository it describes, and the version before
last proved it by reporting `main` two merges behind and no open pull requests while one
was open. This one was written from the template with the previous version closed.

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
the generation route, and the retention rule are failing tests; the security headers are
asserted against a live response and against the running deployment; the adversarial
suite runs against the live model and fails the build if a violation reaches a draft;
claim-bearing text is selected from the library or blocked, never authored; and where a
control cannot be enforced the documentation says so plainly. `docs/THREAT-MODEL.md` says
which is which boundary by boundary, `docs/DATA-PROTECTION.md` does the same for every
minimisation decision, and as of this session `docs/COMPLIANCE-MAP.md` says which
published expectation each of them answers and which it does not. `CLAUDE.md` carries the
non-negotiable constraints.

---

## Where we've been

`main` is at `ce16360` with 278 commits and 54 merged pull requests; this branch adds
session 17. `CHANGELOG.md` is the record of what each session shipped and is not repeated
here. What follows is the map from session to pull request, with the closed-not-merged
ones named because a closed PR is easy to mistake for one that never existed. Verified
this session from the GitHub API: 62 pull requests, 54 merged, eight closed without
merging (#3, #5, #26, #27, #35, #52, #60, #61), none open at the time of writing.

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
- **Session 22, retention implemented** — **#58**, 2026-09-23. ADR-0013 added; ADR-0004
  amended; `fieldnote-iox` closed.
- **Dependency backlog, 2026-10-05** — **#62** the group bump, **#59** the CodeQL action
  pin, **#63** the `brace-expansion` advisory fixed by hand. **#60** and **#61** closed,
  not merged, each with the reason on it.
- **Session 17, the compliance map** — this branch. `docs/COMPLIANCE-MAP.md`; no ADR.

---

## Where we are

`main` is at `ce16360`, CI green on it. No pull requests are open. **Zero open Dependabot
alerts**, down from seven this morning. Branch protection on `main` requires the three
contexts — `Verify`, `Adversarial guardrail suite`, `Analyze (javascript-typescript)` —
requires branches to be up to date, and applies to administrators; it requires no
approving review.

**Twelve days passed with no commits** between session 22 merging on 2026-09-23 and this
session on 2026-10-05. Nothing regressed. What accumulated was dependency work, and it
was not routine.

**The dependency backlog, and the two things in it worth carrying forward.** Three
Dependabot pull requests were waiting and seven alerts were open, all against `undici`,
all development scope. Merging the group bump (#62) cleared all seven, because its
lockfile had already resolved `undici` past the fix. **#61 was then closed rather than
merged: it had been built against an older `main`, and merging it would have rolled back
`@anthropic-ai/sdk` and `next`.** A green, mergeable Dependabot pull request can still be
a regression, and the thing to read is what it would do to the branch it is merging into.
Then two new alerts opened the same morning against `brace-expansion`, and **Dependabot
could not fix them**: its own run failed with `dependency_file_not_resolvable` because
the package is transitive and pnpm resolved the two affected version lines differently
than the advisory asked. No pull request was ever going to arrive. `pnpm update
brace-expansion -r` lifted both lines without an override, because the ranges already
admitted the patched versions. `fieldnote-6gq` carries the technique.

**Versions now on `main`:** `next` 16.3.7, `@anthropic-ai/sdk` 0.129.0, `jsdom` 30.1.1,
`lint-staged` 17.6.0, `prettier` 3.9.9, the CodeQL action at v4.38.1 pinned by commit and
verified against the upstream release tags.

**The compliance map exists**, `docs/COMPLIANCE-MAP.md`, and the three things to know
about it are its negatives. The EU AI Act tier is argued route by route and comes out at
limited risk with transparency the operative obligation; six high-risk obligations are
mapped as implemented voluntarily, each with the reason that actually caused them.
**Article 50's machine-readable marking of synthetic content is recorded as not met**, a
real gap rather than one argued away, because the assistive-editing exemption covers the
selected claim-bearing text and not the generated prose, and export is a clipboard copy a
marker would have to survive (`fieldnote-lr8`, to be settled by an ADR). **The ISO/IEC
42001 section cites no control identifiers at all**, because the standard is paywalled and
this project does not hold a copy, and its headline is that the project has no
organisation and therefore no certifiable management system.

**The private deployment is seven commits behind and the sync is owed.** Public `main` is
at `ce16360`; the private repository is still at `0823118`, session 22's merge. It is
missing all three dependency merges, which include the framework bump and both security
fixes. Session 17 itself changes nothing she can see, but the dependency work does, and
every sync is a production deploy.

**What was verified against the running deployment**, from outside it, on 2026-09-23 after
session 22's sync, and one request on 2026-10-05 confirming it still answers:

- The nine security headers, byte-identical to the baseline taken before that deploy,
  `X-Robots-Tag: noindex, nofollow` included, and `robots.txt` disallowing everything.
- `POST /api/generate` with no cookie refused with 401 and the expected wording; a
  `text/plain` body refused with 415.
- The deployed bundle confirmed to carry the right build from the bundle itself rather
  than inferred from matching commits: the chunk holding the retention notice computes
  the due date as the event's end plus 1,209,600,000 milliseconds, fourteen days, with
  the fallback order intact, and subtracts 604,800,000 for the notice. The thirty-day
  constant appears nowhere in it.
- **Do not poll the domain to wait for a deploy.** Doing so on 2026-09-23 tripped Vercel's
  challenge mitigation and every request from that network returned 403 for about
  thirteen minutes, including one shaped like a mobile browser. The poll's own exit signal
  was false too, because the challenge page carries a fresh token per response so its hash
  changes every time. Read the deployment's state from the platform instead, then make one
  request afterwards. `fieldnote-vxh`.

**What the device showed**, iOS 26.6.2, 2026-09-21: storage reported persistent; capture,
drafting, and the review gate worked; the offline shell held, with the event and note
present after the app was killed in airplane mode and a new note saved; and the access
cookie survived a relaunch, so the key is entered once.

**What the green checks mean.** `Verify` runs the denylist, lint, typecheck, unit tests
(385), build, and the end-to-end suite (52). `Adversarial guardrail suite` skipped the
model on every branch this session: nothing under a watched path changed, which is why the
private-term resolver sits where it does. The caveats:

- **The eval figures are one held-out run at five samples per case**, dated 2026-09-15
  under ruleset 1.4.0. Prompt and ruleset are untouched since.
- **`README.md`'s eval prose contradicts its own eval table** for that run: the prose says
  six produced violations with three off-label, the table says four with one, and the
  per-class rows sum to the table's figure. The prose describes the previous run under
  ruleset 1.3.0 and was carried forward. `fieldnote-12k`, for session 18, which owns
  `README.md`. The compliance map cites the table for this reason.
- **The injection measurement is two payloads and one canary.**
- **The forwardable block has been forwarded by nobody.**
- **The calendar file has been opened by no calendar application.**
- **The pre-event email has never been sent to anyone.**
- **No real photograph and no real site map has been through the resize.**
- **The PDF library is unmaintained** by decision (ADR-0010).
- **The library has never held real approved copy**, so every draft on the device came
  back with gap markers, which is the empty library working.
- **The single-egress check is a grep**, and does not see the settings form post.
- **SRI is partial** (`fieldnote-9gp`); **CI enforces structural denylist patterns only**;
  **the end-to-end suite runs in one browser**; **the service worker's update path is
  untested** (`fieldnote-unp`).
- **The required-checks tripwire sees the code side only.**
- **The event name and the approved passages cross outside the note delimiter**
  (`fieldnote-3rl`).
- **`persistence.spec.ts:92` is intermittent** (`fieldnote-ccf`). It passed in this
  session's full runs.
- **Nothing in the repository verifies any platform setting.** Deployment protection, the
  toolbar switches, the environment scoping of all three variables, the spend limit, and
  the device's auto-lock are all settings elsewhere. `vercel.json` carries the region; the
  rest is a hand check each session.
- **The private term list is untestable in public by construction.**
- **The `Dependabot Updates` workflow's last run failed**, at 15:58 on 2026-10-05, on the
  `brace-expansion` resolution described above. #63 fixed the underlying problem by hand;
  whether the next scheduled run goes green is unconfirmed.

**Schema is at v9**, unchanged through five sessions, and deliberately: neither the caller
key, the storage line, the session 23 work, retention, nor the compliance map needed a
field.

**Versions.** Prompt template 1.2.0; guardrail ruleset 1.4.0. Neither changed.

**Documentation set.** `README.md`, `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md` (session
17 amended on completion), `docs/TESTING-ON-DEVICE.md`, `docs/THREAT-MODEL.md`,
`docs/DATA-PROTECTION.md`, **`docs/COMPLIANCE-MAP.md` (new)**, thirteen ADRs with an index
and `CLAUDE.md`'s list complete, `docs/prompts/` for sessions 3 through 17 and 20 through
23, this handoff and its template, `CHANGELOG.md`, `SECURITY.md`. Plan §4.6's
`docs/ARCHITECTURE.md` and `docs/AI-SYSTEM-CARD.md` are the two that do not exist yet.

---

## What's next

### Session 18 — README, system card, demo

The next guide session, and the last of phase 4 apart from the demo recording. Read the
guide entry in full before writing prompts for it. It now inherits three things from this
session: `fieldnote-12k`, the eval figure contradiction inside `README.md` itself, which
should be fixed by re-deriving the paragraph from the 1.4.0 run rather than by editing the
number; `docs/COMPLIANCE-MAP.md`, which the system card should point at rather than
restate; and the README navigation sentence, which this session extended only as far as
making the governance documents reachable.

`docs/ARCHITECTURE.md` from plan §4.6 has no session of its own in the guide and is worth
raising with the owner rather than assuming it belongs to 18.

### Owner actions owed, none of which this repository can verify

- **The private repository sync**, which is a production deploy and is currently seven
  commits behind, holding a framework bump and two security fixes.
- **The Vercel project's settings**, as a standing hand check: protection scope and
  method, all three variables scoped to Production, analytics and the toolbar off.
- **Session 23's two outstanding checks, still never answered**, now two weeks old. The
  start-up line after that deploy, where `modelKey` should read `present`; and the phone
  walk of the reachable Device link, the access form's three outcomes, and the cream
  palette. Nothing here knows how that deploy behaved.

Done and unverifiable from here: the **spend limit** on the model API key was set on
2026-09-21 and was **not** replaced. What was replaced, on 2026-09-22, was the **model
key**, within the same capped workspace, after the original had not reached Production.
Also done: automatic screen lock on the representative's device, 2026-09-21
(`docs/THREAT-MODEL.md` §5.6).

Still owed and unchanged: a real photo and a real site map through the resize; the real
approved content loaded, which is the first thing the deployment is waiting for; a
calendar application opening the `.ics`; a forwarded block read in a second mail client;
and the rest of `fieldnote-bdw` — the seven idle days and real storage pressure.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session, by doing, before the first tracker
write and after the last: `backup.git-push` is false, `git ls-remote origin 'refs/dolt/*'`
returns nothing, and `core.hooksPath` still reads `.husky/_`. The tracker's data stays on
this machine. 78 issues: 32 open, 45 closed, 1 blocked, 31 ready (`bd stats`). Use `bd
ready` and `bd blocked`; the backlog is not copied here.

Opened this session, all three found while reading rather than written from a plan:
`fieldnote-12k`, the README eval contradiction; `fieldnote-lr8`, the Article 50 marker gap
the compliance map surfaced; `fieldnote-6gq`, the Dependabot transitive-advisory
limitation. Closed this session: none. Still open and load-bearing, each named only
because a claim above leans on it: `fieldnote-bdw` — the eviction window and storage
pressure; `fieldnote-jqk` and `fieldnote-cdx` — the two deletion limits, owner decisions;
`fieldnote-52s` and `fieldnote-5ow` — the cascade test and the records naming three
tables; `fieldnote-8w6` and `fieldnote-ap1` — where dictation runs and whether the store is
backed up; `fieldnote-3rl` — the fields outside the note delimiter; `fieldnote-ccf` — the
intermittent persistence spec; `fieldnote-9gp` and `fieldnote-unp` — partial SRI and the
untested service-worker update; `fieldnote-oa9` — the single-egress tightening and the
stale session-15 pointers; `fieldnote-vxh` — do not poll the production domain. One issue
is blocked: `fieldnote-ao9`, behind `fieldnote-8pl`.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.
Stuck on what it has always been stuck on, and four Dependabot pull requests have now been
closed pointing at it.

**Session prompts — what was asked.** `docs/prompts/`, one file per session from 3 through
17 and 20 through 23. Each carries the prompt as sent and a *how it actually went* section
written on completion. `session-17.md` is the exception worth knowing about: that session
had no written prompt, and the file records the build guide entry and plan §4.6 as the
scope that stood in for one.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once accepted,
superseded or amended with a dated note. **None added or amended this session**, which is
correct: the session recorded a position in a map, and the one decision it surfaced
(`fieldnote-lr8`) belongs to the session that settles it. Still owed: ADR-0004's
availability amendment when `fieldnote-bdw` resolves; ADR-0008's dated note on the cascade
(`fieldnote-5ow`); the three stale "session 15" pointers (`fieldnote-oa9`); ADR-0006's
five-name evidence statement; and the decision `fieldnote-af9` holds.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.**
- **Verify the premises before building on them, and stop when one is wrong** — including
  a premise the tracker carries: a bead is a claim, not a source.
- **Check the watched paths before writing code, not after.** A change under
  `src/lib/generation/` or `src/lib/privacy/` makes the adversarial suite call the live
  model. Twice now a design has been reshaped to avoid it; both times the reshaped version
  was defensible on its own terms, and both times the file says so.
- **A platform's defaults are a claim to check.** The deployment answers on an analytics
  route nobody enabled. Nothing collects, but nothing in the repository would have
  predicted it either.
- **A live weakness not already in a bead goes to the owner in the session.**
- **A dependency gets an ADR before it is installed.**
- **A green Dependabot pull request can still be a regression.** Read what it would do to
  the branch it merges into, not only what it claims to bump: #61 was green, mergeable, and
  would have rolled back the framework and the model SDK.
- **When an alert has no pull request, read the Dependabot run log before assuming the
  pull request is late.** A `dependency_file_not_resolvable` error on a transitive package
  means no pull request is coming and the fix is by hand. Try `pnpm update <pkg> -r` and
  read the lockfile diff; reach for an override only if the ranges refuse, and record it,
  because an override is a pin that masks the next upstream fix.
- **Do not poll the production domain to wait for a deploy.** Read the deployment's state
  from the platform, then make one request. Polling trips the challenge mitigation, and a
  content hash is not a build marker when the origin can return a challenge page.
- **A control that is not tested is not a control, and one that reads as tested is worse.**
- **Verify by running, not by reasoning.**
- **Check every citation before committing a document that makes them.** The compliance
  map's first draft carried three invented bead ids; a mechanical check caught all three.
  In a repository arguing that claims should point at something inspectable, a dead
  reference is the worst available defect.
- **`pnpm evals` costs real spend.**
- **The Content Security Policy is a control, not a setting.**
- **Check what is listening before trusting a red or green e2e run.** `lsof -iTCP:3000`.
  One full-suite failure of `persistence.spec.ts:92` alone is `fieldnote-ccf`, not a
  regression; anything else red is.
- **Dependabot branches go stale**, and protection requires up-to-date branches. Update,
  then re-read the diff, because an update is a chance for the lockfile to change.
- **Verify a pinned action rather than trusting the bump.** Dereference the annotated tag;
  note that a floating major tag may have moved past the pin, which is normal and not a
  reason to reject it.
- **The denylist can fire on ordinary vocabulary and on any address-shaped string.**
- **A refused commit leaves its files staged.** Read `git status` before every commit.
- **The constraints in `CLAUDE.md` are not optional.**
- **A finding about the private material is not written into any location the repository
  controls**, and nor is the private repository's name, its project, or any deployment URL
  or domain.
- **Never `--no-verify`.** Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks, including every `bd` command.
- **`bd update --notes` replaces the field; `--append-notes` appends.** A close reason
  cannot be edited, so a decision that changes after a close goes on as an appended note.
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** Prettier reformats committed files, so read the wrapped text
  before anchoring an edit on it. Markdown is excluded from Prettier and hand-wrapped.
- **A number that governs behaviour is a named constant, and a derived number is derived.**
  The retention period moved from thirty days to fourteen after the work was finished and
  cost two lines of source.
- **Every change that should reach the representative needs the private repository synced,
  and each sync is a production deploy.** Merging to public `main` changes nothing she can
  see. The private repository is fast-forwarded from `upstream/main` and pushed, which is
  what triggers the build; it must never diverge, so if a fast-forward is not possible,
  stop rather than merge. Plan the deploy as part of the session, not after it.
- **One session, one PR**, except where a session must ship code before it can do the rest,
  as session 21 did. Dependency work is its own pull request, not folded into a session.
- **Separate commits per logical change.** Merge commit, not squash.
- **Regenerate this handoff; do not edit it.**

---

## Known gaps in this document

Stated rather than smoothed over.

- **The compliance map was written without an authoritative copy of two of its three
  standards.** NIST AI RMF 1.0 and the EU AI Act are free and cited with reasonable
  confidence; ISO/IEC 42001:2023 is paywalled, this project does not hold it, and that
  section therefore cites no control identifiers. The map says so in two places, and
  nobody with a compliance qualification has read it.
- **The EU AI Act's territorial application to this system is unestablished.** The map
  works as if the Act applied, because mapping to it and then discovering it applies is
  cheap and the reverse is not.
- **The deployment has been used by one person, on one phone, on one day.**
- **Nothing here knows how the deploy of 2026-09-22 behaved.** Session 23's start-up line
  and phone checks were never answered.
- **Retention has never run on the device.** No event on the representative's phone is
  known to have reached its date, and the first real deletion will happen there with
  nobody watching. On the dates available, an event captured on 2026-09-21 would have
  passed its fourteen-day point around 2026-10-05, but whether such an event exists is not
  something this repository can see.
- **No preview deployment exists**, so preview protection is untested.
- **The real approved content has still never been loaded.**
- **The private term list is four terms the working instance never saw.**
- **Nothing in the repository verifies any platform setting or the spend limit.**
- **The threat model's severities are one reader's judgement.**
- **The required-checks test sees the code side only.**
- **`core.hooksPath` cannot be asserted in CI.**
- **The single-egress tightening scheduled for session 15 was not built**
  (`fieldnote-oa9`).
- **The session-to-PR map above, for sessions 1 to 20**, was verified by count and by the
  closed-without-merging set, not by re-reading each pull request.
- **The migration tests run the upgrade functions over fake rows.**
- **The eval figures are one held-out run, one day**, and `README.md` currently disagrees
  with itself about them (`fieldnote-12k`).
- **The containment amendment of 2026-09-09 is not reproduced here.**
- **The seven-day eviction window and real storage pressure are unobserved.**
- **Where the platform's dictation runs, and whether the store is in a backup, are
  unrecorded.**
- **Audit records grow without bound** by design (ADR-0008).
- **A name with neither a title nor a roster entry is still missed.**
- **Hours in the build guide are estimates, not measurements.**

---

## How to use this

**Regenerate, do not edit.** Write each handoff by re-reading the sources — `git log`, the
build guide, `CLAUDE.md`, `docs/adr/README.md`, `bd ready`, `bd blocked`, and the open
GitHub issues.

**Point, do not copy.** Anything with a canonical home gets a pointer.

**Every claim traceable.** To a file, a commit, or a command run while writing. If it is
not, say so in *Known gaps* rather than dropping it silently or asserting it anyway.
