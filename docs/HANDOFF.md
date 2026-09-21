# Handoff

Written 2026-09-16, at the head of `docs/session-16-data-protection`, the session 16
branch, for the state `main` will be in when it merges. `main` is at `5d669b0`; the
branch adds seven commits including this one, and nothing on it has been pushed: the
owner's reviewer reads the branch locally before anything reaches the remote.

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
the generation layer, and the three job names branch protection depends on are failing
tests; the security headers are asserted against a live response; the adversarial suite
runs against the live model and fails the build if a violation reaches a draft; a roster
import, a briefing download, and a composed pre-event email are each shown to make no
network request; claim-bearing text is selected from the library or blocked, never
authored; and where a control cannot be enforced the documentation says so plainly.
`docs/THREAT-MODEL.md` says which is which, boundary by boundary, and since this session
`docs/DATA-PROTECTION.md` says the same for every minimisation decision. `CLAUDE.md`
carries the non-negotiable constraints.

---

## Where we've been

`main` is at `5d669b0` with 238 commits and 43 merged pull requests; this branch adds
seven commits. `CHANGELOG.md` is the record of what each session shipped, from session 2
onward, and is not repeated here. What follows is the map from session to pull request,
with the closed-not-merged ones named because a closed PR is easy to mistake for one that
never existed. Verified this session from `gh pr list --state all`: 48 pull requests,
five closed without merging (#3, #5, #26, #27, #35); #11 is an issue, not a PR.

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
- **Session 15, the threat model** — **#49**. `docs/THREAT-MODEL.md`, and one control,
  `tests/unit/required-checks.test.ts`. Phase 4 opened.
- **Session 16, the data protection assessment** — this branch, no PR yet.
  `docs/DATA-PROTECTION.md`. No code changed.

---

## Where we are

`main` is at `5d669b0`, CI green on it (`gh run list --branch main`). No pull requests
are open. Zero open Dependabot alerts. This branch has not been pushed, so it has no CI
run: what follows about its checks is from local runs.

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, force pushes and deletions disabled, and
signed commits not required. Required approving reviews: **0**, deliberate for a
single-maintainer repository. Verified this session against the classic
branch-protection API; the repository has no rulesets (`gh api repos/…/rulesets` is
empty). `tests/unit/required-checks.test.ts` asserts that the three workflows render
exactly those three job names; the settings side is still a hand check, and the test's
header says so.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests (318), build, and the end-to-end suite (37). `Adversarial guardrail suite`
would skip the model on this branch: nothing under a watched path changes, checked by
reading the diff against `scripts/evals-watched-paths.mjs`. On a PR that touches a
watched path it runs live and says so. Locally this session: unit 318 of 318; the
end-to-end suite run twice in full on the same code, once with 36 of 37 and
`persistence.spec.ts:92` failing, once with 37 of 37, and the failing test passing on an
isolated re-run in between — `fieldnote-ccf`, opened this session, records it as
intermittent. The caveats, unchanged from session 15 except where marked:

- **The eval figures are one held-out run at five samples per case**, in `README.md`,
  dated 2026-09-15 under ruleset 1.4.0, every row held out. 0 of 70 reached, 4 of 70
  produced. Nothing in this session changes them: prompt and ruleset are untouched.
- **The injection measurement is two payloads and one canary.** 0 of 10 produced on the
  held-out run; an obeyed instruction that writes no canary is counted by nothing.
  `docs/THREAT-MODEL.md` §4.
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
  in `docs/THREAT-MODEL.md` §6 with their beads.
- **The required-checks tripwire sees the code side only.** If the required contexts
  change in GitHub's settings, the strings in the test are wrong and nothing in the
  repository says so.
- **The event name and the approved passages cross the boundary outside the note
  delimiter.** `fieldnote-3rl`; `docs/THREAT-MODEL.md` §4; now also
  `docs/DATA-PROTECTION.md` §3.3 and §5.
- **The provider retains the pseudonymized request under its standard commercial
  policy.** Zero data retention is not in place and will not be requested now (owner,
  2026-09-21): deleted within 30 days, up to 2 years for content trust-and-safety systems
  flag, both pages read 2026-09-21. What is retained names nobody. `fieldnote-n9l`,
  closed.
- **The end-to-end suite has one intermittent test** (new). `persistence.spec.ts:92`,
  `fieldnote-ccf`; a full run is green or it is this one test.
- **The installed app has one observed failure mode on the test rig** (new, not a
  code change). With the HTTPS proxy up and the app server down, it showed the proxy's
  error page rather than its stored copy. `fieldnote-cjs`; cause unconfirmed.

**Plan §4.6's `docs/DATA-PROTECTION.md` exists.** The four kinds of data subject; the
inventory of all eleven tables from the schema, every field with the schema's own
reason, nothing re-classified, the classification read as ADR-0004's plan rather than as
encryption in place; six flows in text with what enters, what is stored, what leaves,
and by whose action; retention as the owner decided it (`fieldnote-tcq`, 2026-09-16,
changed 2026-09-17) and as not yet built (`fieldnote-iox`); minimisation as decisions
with the file that enforces each; rights and their limits; the one processor and what
is not verified about it; residual risk citing the threat model's §6 by item. No legal
characterisation anywhere, by design: session 17 does that against named frameworks,
and the document ends with what sessions 17 and 18 need from it.

**Retention is decided and not built.** Scope, the automatic deletion at 30 days, the
warning from day 23, and the period are in `fieldnote-tcq`'s notes of 2026-09-17, which
changed the decision of 2026-09-16, and are written up in `docs/DATA-PROTECTION.md` §4.
`fieldnote-iox` carries the implementation and the ADR it still needs, in its own
session. Until it closes, nothing bounds the store, and ADR-0004's reliance on a small
local store is a policy rather than a property.

**Schema is at v9.** Unchanged this session.

**Versions.** Prompt template 1.2.0; guardrail ruleset 1.4.0; both recorded on every
audit record. Neither changed this session.

**Documentation set.** `README.md` (eval table from session 13's run),
`docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md` (session 16 amended on completion),
`docs/TESTING-ON-DEVICE.md`, `docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md` (new),
eleven ADRs with an index and `CLAUDE.md`'s list complete, `docs/prompts/` through
session 16, this handoff and its template, `CHANGELOG.md` through session 16,
`SECURITY.md`. Plan §4.6's `docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`, and
`docs/COMPLIANCE-MAP.md` do not exist yet (checked with `ls docs`); the threat model's
§6 and the data protection assessment's §8 each end with a paragraph on what the later
documents will need.

---

## What's next

### Session 17 — Compliance map

The guide's entry: controls mapped to NIST AI RMF, EU AI Act, and ISO/IEC 42001; precise
about the risk tier rather than expansive, because accuracy reads better than
overclaiming; the same precision for controls not built — ADR-0004's seam mapped as a
seam, citing the record, not as encryption at rest. Budgeted at ~3 hours. There is no
bead for it (`bd search "Session 17"` finds none); the guide's entry is the scope. Read
it in full.

What it draws on, and where: `docs/THREAT-MODEL.md` §3's third column for what is
enforced and what is documented, and §6 for the residual list;
`docs/DATA-PROTECTION.md` §1 for the data subjects, §2 for the inventory, §3.3 and §7
for what crosses the egress and what does not, §4 for retention as decided and not
built, §5 for the enforced-versus-documented status of each minimisation, and §6 for
the deletion limits and the hash facts. The provider's retention is settled and is not
zero: map it as the standard commercial policy, deleted within 30 days and up to 2 years
for flagged content, not as a zero-retention arrangement (`fieldnote-n9l`, closed
2026-09-21). One thing it depends on is still unsettled: the wording of the §5.5 item,
which it cites from the threat model's §6 verbatim rather than writing its own.

Still owed and unchanged: a real photo and a real site map through the resize on the
device; the real approved content loaded in the private fork; a calendar application
opening the `.ics`; a forwarded block read in a second mail client; and the rest of
`fieldnote-bdw` — one device observation now exists, eight idle days on iOS 26.6.1 with
the notes present, and storage pressure and `persisted()` remain unobserved.

Either way: check the prompt's premises against the repository — including whether the
previous PR has merged — before building on them, and stop when one is wrong. Session
16's prompt was drafted by the session 15 instance and rewritten by Guardian, and one
premise both writers copied from the tracker was false; `docs/prompts/session-16.md`
says which, and that the session stopped on it before writing.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — build state, local.** Verified this session, by doing, before the first
tracker write and after the last: the tracker's data stays on this machine. 73 issues:
35 open, 37 closed, 2 blocked, 33 ready (`bd stats`; `bd ready` agrees). Run `bd ready`
and `bd blocked`.

Named here because they qualify claims made above; the backlog itself is not listed.
Closed this session: `fieldnote-d7d`, the session's own bead, set to open and closed
with a reason naming the document. Opened this session, on the owner's instruction:
`fieldnote-cdx` — no action deletes a single note or a single draft, an owner decision,
related to `fieldnote-jqk`; `fieldnote-ccf` — the intermittent end-to-end test;
`fieldnote-cjs` — the installed app showing the proxy's error page. Annotated this
session: `fieldnote-tg4`, retitled, its second item withdrawn because the roster cap is
asserted at `tests/unit/roster-csv.test.ts:53`; `fieldnote-ao9`, now covering all three
approved-content fields; `fieldnote-bdw`, the owner's device observation appended.
Still open and load-bearing: `fieldnote-iox` — retention, decided and not built;
`fieldnote-jqk` — attendee removal leaves notes and drafts; `fieldnote-52s`,
`fieldnote-5ow` — the cascade test and the records that name three tables;
`fieldnote-8w6`, `fieldnote-ap1` — where dictation runs and whether the store is backed
up, both unrecorded; `fieldnote-3rl` and `fieldnote-bn0` — from the session 15
amendment; `fieldnote-oa9` — three documents point at session 15
for a tightening it did not do; `fieldnote-ay2`, `fieldnote-af9`, `fieldnote-g7d`,
`fieldnote-quj`, `fieldnote-m28`, `fieldnote-6qr`, `fieldnote-5iv`, `fieldnote-9gp`,
`fieldnote-unp`, `fieldnote-ech`, `fieldnote-dx0`, `fieldnote-v2s`, `fieldnote-6x5`,
`fieldnote-ijg` — unchanged since the last handoff.

**GitHub issues — public record.** One open: **#11**, the ESLint flat-config migration.

**Session prompts — what was asked.** `docs/prompts/`, one file per session from 3
through 16. Session 14's was written in-session; sessions 15 and 16 were drafted by the
previous session's instance and rewritten by Guardian, and each file says so. Session
16's file carries two redaction markers where the owner's text named the mechanism by
which the tracker once published.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`; immutable once
accepted, superseded or amended with a dated note. One amended this session: ADR-0001,
dated 2026-09-17, the split unchanged. The retention ADR belongs to `fieldnote-iox`.
Still owed or worth considering: the retention ADR (`fieldnote-iox`); ADR-0004's
availability amendment when `fieldnote-bdw` resolves; ADR-0008's dated note stating the
cascade as it is (`fieldnote-5ow`); the three stale "session 15" pointers
(`fieldnote-oa9`); ADR-0006's five-name evidence statement; and the decision
`fieldnote-af9` holds.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means.
- **Verify the guide's and the prompt's premises before building on them, and stop when
  one is wrong** — including "on `main` after PR #N", and including a premise the
  tracker carries: a bead is a claim, not a source.
- **A fact-finding command whose output is cut is not a fact.** The session 16 stop was
  a `head` that ended two lines above the line that mattered.
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
  And one full-suite failure of `persistence.spec.ts:92` alone is `fieldnote-ccf`, not
  a regression; anything else red is.
- **The denylist can fire on ordinary vocabulary and on any address-shaped string** at
  any domain but `example.com` and `.invalid`. Remove the word rather than bypass the
  hook, and do not name it in the commit.
- **A refused commit leaves its files staged.** Read `git status` before every commit.
- **Check existence and ignore status separately.** `git check-ignore` is a pattern query.
- **The constraints in `CLAUDE.md` are not optional.**
- **A finding about the private material is not written into any location the
  repository controls.** That includes a prompt file quoting a command the owner ran:
  redact the line and say so.
- **Never `--no-verify`.** Check `git config core.hooksPath` still reads `.husky/_` after
  any tool that installs hooks, including every `bd` command.
- **`bd close` refuses a bead blocked on an open one.** Close the blocker first, or the
  order a prompt prescribes will not be the order the tracker allows.
- **`bd update --notes` replaces the field; `--append-notes` appends.** Use the second.
- **`gh pr create`, never `--fill`.**
- **Stage explicit paths.** Prettier reformats committed files, so read the wrapped text
  before anchoring an edit on it. Markdown is excluded from Prettier and hand-wrapped.
- **One session, one PR.** Findings that are not blocking get beads.
- **Separate commits per logical change.** An ADR and its consequences come before any
  code that depends on them. Merge commit, not squash.

---

## Known gaps in this document

Stated rather than smoothed over.

- **This branch has not been pushed and has no CI run.** Every test figure above is a
  local run on this machine; `Verify` and the eval gate have not seen it.
- **The data protection assessment has been read by nobody but the instance that wrote
  it**, and the owner's reviewer reads it next. Its inventory was checked against the
  schema by script; its prose was checked by the writer.
- **The threat model's severities are one reader's judgement**, unchanged.
- **The required-checks test sees the code side only.** The required contexts live in
  GitHub's settings and are verified by hand, this session and each one after.
- **`core.hooksPath` cannot be asserted in CI.** Local configuration; the check is a
  line in the pre-commit hook's comment and a habit.
- **The injection entry's "likely to be withheld" is a reading of the guard, not a
  measurement.** No corpus case has a role-shaped sign-off.
- **The single-egress tightening scheduled for session 15 was not built**, and three
  documents still point at session 15 for it (`fieldnote-oa9`).
- **The forwardable block has been forwarded by nobody**, and its two non-structural
  constraint tests are word lists over four fixed strings.
- **The session-to-PR map above sessions 1 to 15** was verified this session by count
  and by the closed-without-merging set, not by re-reading each PR.
- **The calendar file has not been opened by Mail, Calendar, Outlook, or anything else.**
- **The 1.4.0 rule was written for a sentence nobody saw.**
- **No pre-event email has been sent to anyone.**
- **No real photograph and no real site map has been through the resize.** EXIF
  orientation through `createImageBitmap` on iOS is unobserved.
- **The PDF has been looked at as a rasterised page on one machine** and never printed.
- **The library has never held real approved copy.** Still the first check owed.
- **The migration tests run the upgrade functions over fake rows**, not Dexie's own
  upgrade transaction against IndexedDB.
- **The eval figures are one held-out run, one day.**
- **The containment amendment of 2026-09-09 is not reproduced here.** Its full text is in
  `fieldnote-loh`'s notes; the threat model's §5.5 is deliberately less specific, and
  the data protection assessment's §7 says one sentence about it, and its conclusions
  stand.
- **The hardware evidence is one phone, iOS 26.6.1, on two days.** The 2026-09-08 run
  and the 2026-09-16 reopening after eight idle days. Nothing built in sessions 5 to 16
  has been exercised on hardware beyond opening the app and reading the notes.
- **The layout validation is one observed session**; nothing built since has been
  observed in use.
- **Storage under pressure and `navigator.storage.persisted()` are unobserved.**
  `fieldnote-bdw`.
- **Where the platform's dictation runs, and whether the store is in a backup, are
  unrecorded.** `fieldnote-8w6`, `fieldnote-ap1`; the assessment names both as
  unverified rather than assuming either way.
- **The persistence test's intermittent failure has no known cause.** `fieldnote-ccf`.
- **Nothing is deployed.** `fieldnote-6x5`, `fieldnote-ijg`, `fieldnote-cjs`.
- **The private fork has no session and this handoff has no visibility into it.**
- **Audit records grow without bound** by design (ADR-0008), and retention is decided
  and not built (`fieldnote-iox`).
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
