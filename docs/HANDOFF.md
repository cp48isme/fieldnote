# Handoff

Written 2026-09-21, at the head of `feat/session-20-deployment`, the session 20 branch,
for the state `main` will be in when it merges. `main` is at `ea2d04b`; the branch adds
five commits including this one, and nothing on it has been pushed: the owner's reviewer
reads the branch locally before anything reaches the remote.

Every claim here was checked against the repository, git history, the trackers, Vercel's
documentation, or the GitHub API in the session that wrote it. Where something could not
be verified, it says so rather than smoothing over the gap.

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
the generation layer, the three job names branch protection depends on, and — since this
session — the caller key on the generation route are failing tests; the security headers
are asserted against a live response; the adversarial suite runs against the live model
and fails the build if a violation reaches a draft; claim-bearing text is selected from
the library or blocked, never authored; and where a control cannot be enforced the
documentation says so plainly. `docs/THREAT-MODEL.md` says which is which, boundary by
boundary; `docs/DATA-PROTECTION.md` does the same for every minimisation decision.
`CLAUDE.md` carries the non-negotiable constraints.

---

## Where we've been

`main` is at `ea2d04b` with 253 commits and 46 merged pull requests; this branch adds
five commits. `CHANGELOG.md` is the record of what each session shipped, from session 2
onward, and is not repeated here. What follows is the map from session to pull request,
with the closed-not-merged ones named because a closed PR is easy to mistake for one that
never existed. Verified this session from `gh pr list --state all`: 52 pull requests, six
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
- **Session 7, adversarial eval suite** — **#39**. **Between 7 and 8** — **#40**,
  ruleset 1.2.0 from the first held-out run.
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
- **Session 15, the threat model** — **#49**; `tests/unit/required-checks.test.ts`.
  Phase 4 opened.
- **Session 16, the data protection assessment** — **#53**. `docs/DATA-PROTECTION.md`;
  ADR-0001 amended; plan §2 retitled and §7 renumbered. No code changed.
- **Dependabot, this session** — **#50** (two action pins) and **#51** (ten npm minor
  and patch bumps) merged, one at a time with main's CI green between them. **#52**, the
  `eslint-config-next` 16 bump, closed not merged: issue #11 tracks the flat-config
  migration that has to land first.
- **Session 20, the deployment decision and the route's caller controls** — this branch,
  no PR yet. ADR-0012.

---

## Where we are

`main` is at `ea2d04b`, CI green on it. No pull requests are open. Zero open Dependabot
alerts. This branch has not been pushed, so it has no CI run: everything below about its
checks is from local runs.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, force pushes and deletions disabled, and
signed commits not required. Required approving reviews: **0**, deliberate for a
single-maintainer repository. `tests/unit/required-checks.test.ts` asserts the three
workflows render exactly those job names; the settings side is still a hand check. The
strict-up-to-date rule showed its teeth this session: both Dependabot branches were
behind `main` and each had to be updated, and re-read after the update, before it could
merge.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (344), build, and the end-to-end suite (43). `Adversarial guardrail suite`
would skip the model on this branch: nothing under a watched path changes, checked by
reading the diff against `scripts/evals-watched-paths.mjs`, and keeping it that way is
why the caller key is a cookie rather than a header. Locally this session: unit 344 of
344; end-to-end 43 of 43 in one full run, with no flake. The caveats:

- **The eval figures are one held-out run at five samples per case**, in `README.md`,
  dated 2026-09-15 under ruleset 1.4.0. 0 of 70 reached, 4 of 70 produced. Prompt and
  ruleset are untouched since.
- **The injection measurement is two payloads and one canary.**
- **The forwardable block has been forwarded by nobody.**
- **The calendar file has been opened by no calendar application.**
- **The pre-event email has never been sent to anyone.**
- **No real photograph and no real site map has been through the resize.**
- **The PDF library is unmaintained** by decision (ADR-0010).
- **The library has never held real approved copy.**
- **The single-egress check is a grep**, and since ADR-0012 there is a second
  same-origin request it does not see and could not: the settings form post. What bounds
  that is `form-action 'self'`, asserted live. `docs/THREAT-MODEL.md` §6.
- **SRI is partial** (`fieldnote-9gp`); **CI enforces structural denylist patterns
  only**; **the end-to-end suite runs in one browser**; **the service worker's update
  path is untested** (`fieldnote-unp`).
- **The required-checks tripwire sees the code side only.**
- **The event name and the approved passages cross the boundary outside the note
  delimiter.** `fieldnote-3rl`.
- **The end-to-end suite has one intermittent test**, `persistence.spec.ts:92`,
  `fieldnote-ccf`. It passed in this session's full run.
- **The installed app has one observed failure mode on the LAN rig** (`fieldnote-cjs`).
- **Nothing in the repository verifies any Vercel setting** (new). Deployment
  protection, the toolbar switches, the environment scoping of both variables, and the
  spend limit all live in the platform's dashboard or the provider's console.
  `vercel.json` carries the region; the rest is a hand check, the same standing gap as
  branch protection.

**Plan §4.6's document set is complete except two.** `docs/ARCHITECTURE.md` and
`docs/AI-SYSTEM-CARD.md` do not exist (checked with `ls docs`); `docs/COMPLIANCE-MAP.md`
does not either and is session 17.

**ADR-0012 exists.** Where the application runs and who may call the route, decided
together. Every claim about the platform is cited to its page with the date read,
2026-09-21. The Pro plan is required rather than preferred: the free tier's terms permit
non-commercial personal use only, and the fair use guidelines define commercial usage to
include a tool used for the financial gain of anyone involved, naming a paid employee.

**The route is no longer open.** It refuses a body that is not JSON with 415 and an
unknown caller with 401, both before reading the body, and refuses everything when
`FIELDNOTE_ACCESS_KEY_HASHES` is unset rather than falling back to open. The key is held
as a hash on the server, compared through `timingSafeEqual` with every configured hash
compared even after one matches, and reaches the server in an `HttpOnly` cookie set by a
plain form on a new settings screen. Nothing about it is in IndexedDB, `localStorage`, or
`document.cookie`, and a browser test asserts the last of those.

**The provider's retention is decided and is not zero.** Zero data retention is not in
place on the account and will not be requested now (owner, 2026-09-21). The standard
commercial policy applies: inputs and outputs deleted within 30 days of receipt or
generation, and content flagged by automated trust-and-safety systems kept for up to 2
years, both pages read 2026-09-21. What is retained names nobody, because what crosses is
pseudonymized. `fieldnote-n9l` is closed.

**Retention in the local store is decided and not built.** Automatic deletion 30 days
after the event ends, a notice from day 23, her own delete at any time, audit records
kept, the period a build-time constant (`fieldnote-tcq`, 2026-09-17). `fieldnote-iox` is
the implementation and is now session 22.

**Schema is at v9.** Unchanged this session, and deliberately: the caller key needed no
schema field, which is what the cookie design bought.

**Versions.** Prompt template 1.2.0; guardrail ruleset 1.4.0. Neither changed.

**Documentation set.** `README.md`, `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md` (a new
Deployment section; session 20 amended on completion), `docs/TESTING-ON-DEVICE.md`,
`docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, twelve ADRs with an index and
`CLAUDE.md`'s list complete, `docs/prompts/` through session 20, this handoff and its
template, `CHANGELOG.md`, `SECURITY.md`.

---

## What's next

Two sessions are now ready, and they are independent of each other. Session 17 is the
next Phase 4 document; session 21 is the first deployment. The guide describes both and
should be read in full before either.

### Session 17 — Compliance map

Controls mapped to NIST AI RMF, the EU AI Act, and ISO/IEC 42001; precise about the risk
tier rather than expansive; ADR-0004's seam mapped as a seam. Budgeted at ~3 hours. There
is no bead for it; the guide's entry is the scope.

What it draws on: `docs/THREAT-MODEL.md` §3's third column and §6;
`docs/DATA-PROTECTION.md` §1, §2, §3.3, §4, §5, §6, and §7; and now ADR-0012 for the
hosting decision and the route's caller control. **The provider's retention is settled
and is not zero** — map it as the standard commercial policy with the periods above, not
as a zero-retention arrangement (`fieldnote-n9l`, closed). One thing is still unsettled:
the wording of the §5.5 item, which it cites from the threat model's §6 verbatim rather
than writing its own.

### Session 21 — The private repository, deployed

The private repository created from the public one as a new private repository rather
than a GitHub fork; its Vercel project configured as ADR-0012 says; a key generated and
installed; `fieldnote-6x5` verified against a real build, because a missing precache
manifest fails silently; and a device check against the deployed origin, including
whether the access cookie survives in the installed app. Budgeted at ~4 hours.

### Owner actions owed, none of which this repository can verify

- **The Vercel project's settings**, once session 21 creates it: protection scope and
  method, both variables scoped to Production, analytics and the toolbar off.

Two that were owed are done, both on 2026-09-21, and both remain unverifiable from here:
the spend limit on the model API key, set in the provider's console on a workspace
dedicated to this deployment (ADR-0012), and automatic screen lock on the
representative's device (`docs/THREAT-MODEL.md` §5.6; ADR-0004 row 1).

Still owed and unchanged: a real photo and a real site map through the resize; the real
approved content loaded in the private fork; a calendar application opening the `.ics`; a
forwarded block read in a second mail client; and the rest of `fieldnote-bdw` — one
device observation exists, eight idle days on iOS 26.6.1 with the notes present, and
storage pressure and `persisted()` remain unobserved.

Either way: check the prompt's premises against the repository before building on them,
and stop when one is wrong. Session 20's prompt was written by Guardian, and one premise
in it could not be built without triggering the eval gate;
`docs/prompts/session-20.md` records the stop and the owner's redesign.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session, by doing, before the first
tracker write and after the last: the tracker's data stays on this machine. 73 issues: 33
open, 39 closed, 2 blocked, 31 ready (`bd stats`). Run `bd ready` and `bd blocked`.

Named here because they qualify claims made above. Closed this session: `fieldnote-9n1`,
the route's controls, with the reason naming ADR-0012 and the tests; `fieldnote-n9l`, the
provider's retention, on the owner's decision. Annotated: `fieldnote-ijg` and
`fieldnote-v2s`, which sessions 21 and 22 now own. Still open and load-bearing:
`fieldnote-iox` — retention, session 22; `fieldnote-6x5` — the precache manifest on a
real build, which blocks `fieldnote-ijg` and is session 21's first check;
`fieldnote-jqk`, `fieldnote-cdx` — the two deletion limits, both owner decisions;
`fieldnote-52s`, `fieldnote-5ow` — the cascade test and the records that name three
tables; `fieldnote-8w6`, `fieldnote-ap1` — where dictation runs and whether the store is
backed up; `fieldnote-3rl` — the fields outside the note delimiter; `fieldnote-bn0` — the
clipboard after export; `fieldnote-ccf` — the intermittent test; `fieldnote-cjs` — the
proxy's error page; `fieldnote-bdw`, `fieldnote-9gp`, `fieldnote-unp`, `fieldnote-ech`,
`fieldnote-dx0`, `fieldnote-oa9`, `fieldnote-ao9`, `fieldnote-tg4`, and the rest of the
backlog, unchanged.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.
#52 was closed pointing at it.

**Session prompts — what was asked.** `docs/prompts/`, one file per session from 3
through 16, plus 20. Session 20's carries the prompt, the owner's two mid-session
additions, and how it went.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once
accepted, superseded or amended with a dated note. One added this session: ADR-0012. None
amended. Still owed or worth considering: the retention ADR (`fieldnote-iox`, session
22); ADR-0004's availability amendment when `fieldnote-bdw` resolves; ADR-0008's dated
note stating the cascade as it is (`fieldnote-5ow`); the three stale "session 15"
pointers (`fieldnote-oa9`); ADR-0006's five-name evidence statement; and the decision
`fieldnote-af9` holds.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.**
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong** — including a premise the tracker carries: a bead is a claim, not a
  source.
- **A fact-finding command whose output is cut is not a fact.**
- **Check the watched paths before writing code, not after.** A change under
  `src/lib/generation/` or `src/lib/privacy/` makes the adversarial suite call the live
  model. Session 20's first design did, and was redesigned rather than paid for.
- **A live weakness not already in a bead goes to the owner in the session, and nowhere
  the repository controls.**
- **A dependency gets an ADR before it is installed.**
- **A control that is not tested is not a control, and one that reads as tested is
  worse.**
- **Verify by running, not by reasoning.** Session 20's first attempt to test that the
  policy blocks an injected toolbar script tested the case the policy deliberately
  allows.
- **`pnpm evals` costs real spend.**
- **The Content Security Policy is a control, not a setting.**
- **Check what is listening before trusting a red or green e2e run.** `lsof -iTCP:3000`.
  A stale server from an earlier session made the whole suite red against a build that
  predated the branch, again. And one full-suite failure of `persistence.spec.ts:92`
  alone is `fieldnote-ccf`, not a regression; anything else red is.
- **Dependabot branches go stale.** Protection requires up-to-date branches, so each
  needs updating before it merges — and the diff re-read afterwards, because an update is
  a chance for the lockfile to change.
- **Verify a pinned action rather than trusting the bump.** Dereference the tag and
  compare the commit.
- **The denylist can fire on ordinary vocabulary and on any address-shaped string.**
- **A refused commit leaves its files staged.** Read `git status` before every commit.
- **The constraints in `CLAUDE.md` are not optional.**
- **A finding about the private material is not written into any location the repository
  controls.**
- **Never `--no-verify`.** Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks, including every `bd` command.
- **`bd update --notes` replaces the field; `--append-notes` appends.**
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** Prettier reformats committed files, so read the wrapped text
  before anchoring an edit on it. Markdown is excluded from Prettier and hand-wrapped.
- **One session, one PR.** Findings that are not blocking get beads.
- **Separate commits per logical change.** Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **This branch has not been pushed and has no CI run.** Every figure above is a local
  run on this machine.
- **ADR-0012 has been read by nobody but the instance that wrote it.** Its Vercel claims
  were read from the documentation on 2026-09-21 and cited; the reasoning around them is
  one reader's.
- **Nothing is deployed, so every Vercel claim is about a platform this project has not
  used yet.** Whether the settings behave as documented is session 21's to find out.
- **The caller key is a shared secret.** It is not bound to the device beyond living in
  that browser's cookie jar; a copied cookie works until the hash is removed.
- **Whether the cookie survives in the installed app on iOS is unverified.** If it does
  not, drafting refuses and she re-enters the key.
- **The spend limit is set by the owner and nothing in the repository verifies it.** Set
  2026-09-21, on a workspace dedicated to this deployment; nothing here reads it, tests
  it, or would notice it being removed.
- **Automatic screen lock is set on the representative's device**, by the owner,
  2026-09-21 (`docs/THREAT-MODEL.md` §5.6). The application neither enforces it nor
  detects it, so that is a fact about one day and not a property of the system.
- **The threat model's severities are one reader's judgement.**
- **The required-checks test sees the code side only.**
- **`core.hooksPath` cannot be asserted in CI.**
- **The single-egress tightening scheduled for session 15 was not built**
  (`fieldnote-oa9`).
- **The session-to-PR map above sessions 1 to 16** was verified this session by count and
  by the closed-without-merging set, not by re-reading each PR.
- **The 1.4.0 rule was written for a sentence nobody saw.**
- **The migration tests run the upgrade functions over fake rows.**
- **The eval figures are one held-out run, one day.**
- **The containment amendment of 2026-09-09 is not reproduced here.**
- **The hardware evidence is one phone, iOS 26.6.1, on two days.** Nothing built since
  session 5 has been exercised on hardware beyond opening the app and reading the notes.
- **Storage under pressure and `navigator.storage.persisted()` are unobserved.**
- **Where the platform's dictation runs, and whether the store is in a backup, are
  unrecorded.**
- **Audit records grow without bound** by design, and local retention is decided and not
  built.
- **A name with neither a title nor a roster entry is still missed.**
- **Hours in the build guide are estimates, not measurements**, and the three new
  Deployment entries are estimates for work nobody has done.

---

## How to use this

**Regenerate, do not edit.** Write each handoff by re-reading the sources — `git log`,
the build guide, `CLAUDE.md`, `docs/adr/README.md`, `bd ready`, `bd blocked`, and the
open GitHub issues.

**Point, do not copy.** Anything with a canonical home gets a pointer.

**Every claim traceable.** To a file, a commit, or a command run while writing. If it is
not, say so in *Known gaps* rather than dropping it silently or asserting it anyway.
