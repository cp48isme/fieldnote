# Handoff

Written 2026-09-08, at `77a7d66` on `main`.

Every claim here was checked against the repository, git history, the trackers, or the
GitHub API in the session that wrote it. Where something could not be verified, it says
so rather than smoothing over the gap.

Regenerate this document from `docs/HANDOFF-TEMPLATE.md` at the end of each session, by
re-reading the sources. Do not edit the previous handoff in place — a handoff written
from the last handoff drifts from the repository it describes.

---

## What this is

A local-first PWA for a field representative running demonstration events for regulated
products. It captures attendee interactions in the field and drafts personalised
follow-up correspondence for human review. Full detail in `docs/PROJECT-PLAN.md`; this
section is orientation only.

Two things shape everything else.

**Public build, private fork.** This repository is the de-branded public build:
synthetic data, no manufacturer, no product, no real people anywhere including commit
history. A private fork carries real configuration and is never published. ADR-0001 is
the record.

**Governance is load-bearing, not decorative.** The compliance architecture is
production code held to the same standard as any feature. In practice that means a
control is expected to be *enforced*, not asserted — the denylist runs in a pre-commit
hook and in CI, the data-access boundary is a failing test rather than a convention, and
where a control cannot be enforced the documentation says so plainly. `CLAUDE.md`
carries the non-negotiable constraints; they are not preferences, and a change that
violates one is wrong regardless of how well it is implemented.

---

## Where we've been

79 commits on `main`, 23 merged pull requests, two open. Verified with
`git rev-list --count main` and `gh pr list`.

**Phase 0 — foundation.** Build guide session 1. The Next.js 16 scaffold, CI, and the
security baseline landed first as two direct commits (`989d459`, `d509dca`), then
through PRs: **#6** repository hygiene and secret scanning, **#7** replacing the
unmaintained `xlsx` dependency, **#8** adopting the Next 16 tsconfig changes. Dependabot
PRs **#1**, **#2**, **#4** carried dependency bumps. PRs **#3** and **#5** were closed
rather than merged — see *What's next*.

**Documentation consolidation.** **#9** revised the plan and build guide to record
Phase 0 as shipped, moved both into `docs/`, and added ADR-0004 and ADR-0005 with the
ADR index. **#10** verified ADR-0004's full-disk-encryption premise and converted
ADR-0005's single-egress claim into a CI check owed at session 5.

**Session 2 — data layer and persistence.** **#12**, four commits. Dexie schema for the
eight entities in plan §5 plus an internal session-marker table; migration scaffolding
from v1; a single data-access layer under `src/lib/db/` that is the only place Dexie is
imported; `encrypt`/`decrypt` hooks as identity pass-throughs per ADR-0004; every schema
field classified encryption-eligible or clear; debounced autosave; and crash recovery
with an explicit recovered-session state.

**Beads.** **#13** set up the internal issue tracker. Most of that PR is not the tracker
— `bd init` repointed `core.hooksPath` away from `.husky/`, silently disabling the
denylist and gitleaks pre-commit gate, and rewrote instructions in `CLAUDE.md`. The PR
restores the gate, chains beads behind it, and records both findings as beads.

**Handoff protocol.** **#14** added this document, `docs/HANDOFF-TEMPLATE.md`, and the
two `CLAUDE.md` working agreements behind them: regenerate the handoff from sources at
the end of every session, and prefer the plainly correct implementation.

**Session 3 — capture UI and offline shell.** **#15**, thirteen commits, merged at
`7c09831`. The capture dock and log on the session 2 data layer; the PWA manifest and a
hand-written service worker; e2e coverage of both; the previously untested
`resumeSession` path; a gitignored `private/` path for pre-de-branding material; and
document amendments. Six of the thirteen commits are review findings fixed in place — a
viewport scale lock that failed WCAG 1.4.4, a service worker that could never update, an
autosave `flush` that resolved while a write was still running, a CodeQL missing-await,
and the discovery that the capture screen had no path to a second event. The data layer
and the schema had supported several all along — `createEvent` and `listEvents` were
unconstrained from session 2, and `Settings.activeEventId` had sat there unused since
then — so the single-event assumption was the new UI's, not the design's.

The session did **not** do what the build guide told it to. The guide says to port an
already-validated prototype and not to redesign it; that prototype was a Claude artifact
built outside this repository, it was not retrieved, and the capture surface was built
from plan §3.1 instead. The guide and §3.1 were amended in the same PR, and the layout is
tracked as unvalidated in `fieldnote-xjs`. Nothing here should describe it as ported.

**Project inputs and the denylist.** Two small PRs after session 3, neither attached to a
build guide session. **#16** recorded plan §7 items 1 to 3 as received or resolved and
widened the rule governing how that material may be adapted into public eval cases —
previously names only, now product and commercial detail as well. **#17** removed
`public/` from the denylist's skip list, where a real name in a committed SVG would have
gone unscanned, and wrote the term check's literal-match limitation into the script
header. **#18** regenerated this handoff.

**Session 4 — the privacy boundary.** **#19**, four commits, merged at `8445e5f`.
`src/lib/privacy/` with roster matching, structural name detection, and a guard on the API
client; dictation fixtures in their own commit with per-case provenance; and ADR-0006
recording what changed about the boundary's meaning.

The session's substantive addition is structural detection: a token following a title is a
name whether or not the roster knows it. Roster matching alone is fail-open by
construction — it cannot catch a name it was never told about, and dictation reliably
produces exactly that. ADR-0006 carries the reasoning, the rejected alternatives, and the
residual risk.

**The first device run, and what it found.** Running the app on a phone over
`http://<LAN-IP>:3000` produced an indefinite "Loading…" and an unhandled rejection:
`crypto.randomUUID` is secure-context only, so `beginSession` threw while reads succeeded,
and `ready` gated the screen on both. **#20** made data-layer failures visible — a
session-marker failure degrades to capture without crash recovery, a failing read or write
reaches a terminal state naming the fault and the action, and an insecure origin is refused
up front rather than run anyway. No fallback id generator: it would leave permanently
unexercised code in the tree and make device tests run against a build differing from
production in the data layer. **#21** added `pnpm serve:https`, which is what makes device
testing possible at all. **#22** stopped `next dev` writing to `CLAUDE.md`.

**Between sessions 4 and 5.** **#23** regenerated this handoff. **#24** moved the session
prompts into `docs/prompts/` and resolved two conflicts between `CLAUDE.md` and the build
guide before session 5 could resolve them silently — eval ordering, and claim-bearing text
with no library to select from. **#25** recorded that session 5's budget is understated
as a consequence.

**The certificate trust flow, tried on hardware and fixed.** **#28**. The runbook's
single-certificate steps were followed on an iPhone and offered nothing to trust:
Certificate Trust Settings enumerates trust anchors, and a leaf asserting `CA:FALSE` is
not one. `scripts/serve-https.mjs` now generates a small certificate authority and signs
the server certificate with it; the authority goes on the phone. That was the first
finding in this project to come from a physical device.

**The first full hardware run.** The PR carrying this handoff, documentation only. The
owner walked the whole flow on a physical iPhone and the representative dictated into
the capture surface. What passed, what it corrected, and what it opened are under *Where
we are*; the runbook, the build guide, and seven beads changed as a result.

---

## Where we are

`main` is at `77a7d66` with a clean working tree. Two pull requests are open, both from
Dependabot: **#26**, the minor-and-patch group, and **#27**, `eslint-config-next` 16.3.4 —
the same major that #3 was closed for and that issue #11 tracks as a migration rather than
a bump. CI green on the last merge (`gh run list --branch main`).

**Branch protection** requires three status checks — `Verify`, `Adversarial guardrail
suite`, `Analyze (javascript-typescript)` — with admin enforcement on, strict up-to-date
branches, required conversation resolution, and force pushes disabled. Required approving
reviews: **0**, which is deliberate for a single-maintainer repository but worth knowing:
the gate is CI, not review. Verified against the branch-protection API this session.

**What the green checks actually mean.** `Verify` runs the denylist, lint, typecheck,
unit tests, and build, and those are real. Five caveats matter more than the badge:

- **The eval suite passes against zero cases.** `scripts/evals.mjs` prints
  `evals: no cases defined yet (scaffold placeholder)` and exits 0 — still true this
  session. Every green "Adversarial guardrail suite" check since PR #7 is evidence that
  the wiring works, not that any guardrail holds. It is also a *required* check, so the
  gate currently proves nothing about guardrails. Real cases begin at session 5 and the
  runner lands at session 7.
- **CI enforces structural denylist patterns only.** The literal-term list lives in
  `.denylist.local`, which is gitignored by design and therefore absent on a runner. CI
  cannot catch a real name in a diff; only the local pre-commit hook can.
- **The local hook catches listed spellings, not names.** Terms compile to
  case-insensitive regexes with word boundaries, so a name split across words, missing a
  letter, or carrying a trailing plural passes clean — verified, not assumed. Text derived
  from `private/dictated-notes.md` is precisely what this cannot see, and from session 4
  the tokenizer fixtures and eval corpus are made of that text. Human review of those
  diffs is the control; the hook is the backstop. `fieldnote-ech`, which also owes
  session 15 a threat-model entry.
- **The service worker's update path is not covered by any test.** Verified by hand
  twice; the worker's own header says so, and `fieldnote-unp` carries the procedure.
- **The suite cannot enter every environment.** Playwright runs against `127.0.0.1`, a
  secure context, so no test could reach the failure a phone hit on the first try.
  `tests/e2e/environment.spec.ts` covers it by reproducing the *API surface* rather than
  the origin. And no harness here can trust a certificate authority, install to a home
  screen, or wait seven days for Safari's eviction window. Worth carrying forward as a
  habit: a green suite says nothing about environments the harness cannot enter, and the
  hardware run this session is the first time several of those were entered at all.

**The privacy boundary exists**, ahead of the route that will cross it. Names are
replaced by roster matching and by a structural rule — a token after a title is a name
whether or not the roster knows it — and `assertPseudonymized` re-derives what a name looks
like rather than trusting that the tokenizer ran, so removing the structural pass makes a
test fail. That counterfactual is demonstrated in the suite, not asserted.

Two things about it are worth carrying forward rather than rediscovering. It
over-tokenizes on purpose: a tokenized non-name costs an odd sentence in a draft a human is
about to read, a missed name sends identity to a third party, and ADR-0006 records that as
a decision. And fail-closed means tokenizing more, never refusing to draft — nothing in the
module can surface an error to the representative, because a tool that errors in a car park
is one that stops being used.

**What the offline claim rests on.** Plan §5 non-negotiable 5 is met, and as of this
session it is met on hardware rather than only in the harness. Headlessly, the standard
was set early: with the app loaded and a note captured, the server process was killed, a
page fetch to the origin was confirmed refused, the HTTP cache was disabled, and a full
reload still rendered the capture screen with the note intact. `tests/e2e/offline.spec.ts`
is the automated form, confirmed to fail when the worker is replaced with one that
activates but caches nothing. On the phone, the equivalent was harsher: two notes
captured, airplane mode on, the app killed from the switcher, reopened from the home-screen
icon — both notes present, a third captured with no network.

The update path was found broken under review in session 3 and fixed in the same PR.
`public/sw.js` is generated from `src/sw/service-worker.js` with the build id stamped in,
caches are named per build, and navigations fetch with `cache: "reload"`. Two limits
remain: the worker registers in production builds only, so `next dev` has no offline
behaviour by design; and whether the generated `public/sw.js` and `public/precache.json`
survive a Vercel deploy is **unverified** — `fieldnote-6x5`, which is now load-bearing
rather than theoretical because nothing is deployed and real use needs it to be
(`fieldnote-ijg`).

**Device testing works, and has now been done.** `pnpm serve:https` serves the production
build over HTTPS on the LAN address, behind a locally generated certificate authority whose
signed certificate covers that address. `docs/TESTING-ON-DEVICE.md` is the runbook, and
its *Verified on hardware* section now records a walk of the whole flow on a physical
iPhone rather than a documented procedure:

- The authority installs, appears under Certificate Trust Settings, can be fully trusted,
  and the LAN HTTPS URL loads in Safari with no interstitial. `fieldnote-zxo` closed.
- Add to Home Screen renders the Fieldnote mark from the SVG manifest icon and opens
  standalone. `fieldnote-lkm` closed; there is no `apple-touch-icon`, and none is needed.
- The offline shell holds after a full kill, as above.
- A word inserted mid-sentence into an existing note, typing continuously, held the caret
  through autosave — the dictation-correction case the textarea was built for, never
  before exercised against a real software keyboard.

Three traps the runbook records, all found by running things. `next dev
--experimental-https` is not the answer: it is `next dev` only, its certificate never
covers the LAN address, and when `mkcert -install` cannot prompt it falls back to plain
HTTP while continuing to serve. Ignoring a certificate error is not trusting the
certificate: `serviceWorker.ready` never resolves. And a self-signed leaf can never be
trusted on iOS at all, which is why the setup is an authority plus a signed certificate.
Verification of that setup is split in two halves, TLS chain and browser behaviour, because
Chromium's key-pinning flag does not walk the chain; the runbook says why so it does not
read as an omission.

**The dictation evidence, restated.** The build guide's session 3 entry says OS dictation
"will mangle surnames". After this session the evidence shows two failure classes, and a
dated amendment in the guide now says so:

- **Surnames**: one phone test, five spoken, four clean, one severe (`Swali` → `Swelha`,
  ADR-0006). The owner's own dictation on hardware has come through clean twice since.
  Rare and severe, not constant and mild — which strengthens the case for the structural
  rule, because rare means nobody is watching for it.
- **Clinical and domain vocabulary**: the representative's dictation rendered two domain
  terms as phonetically similar ordinary English words, producing plausible sentences
  that would survive a quick proofread. That is data quality, not privacy. The tokenizer
  must not touch it, and it reaches the model as fact. `fieldnote-dx0` carries it and
  records, from what is written rather than by decision, that plan §4.2 does not answer it
  by construction: a note's own words are relational text and pass freely. It lands on
  session 5's classifier and session 15's threat model.

One literal pair from the vocabulary class is held back from the public documents because
it narrows the device category; the owner holds it and the bead says so.

**Project inputs.** Plan §7 items 1 and 2 live at `private/`, which is gitignored and
holds two files: writing samples and uncorrected dictated notes. Item 3 is recorded as
resolved; item 4 — what approved content actually exists, needed by session 9 — is still
open. Per §7 as amended, anything adapted from either file into public eval cases has
names **and product and commercial detail** replaced.

**Documentation set.** `docs/PROJECT-PLAN.md`, `docs/BUILD-GUIDE.md`,
`docs/TESTING-ON-DEVICE.md`, six ADRs with an index at `docs/adr/README.md`,
`docs/prompts/`, this handoff and its template, plus `CHANGELOG.md` and `SECURITY.md`.
Plan §4.6 also specifies `README.md`, `docs/ARCHITECTURE.md`, `docs/AI-SYSTEM-CARD.md`,
`docs/THREAT-MODEL.md`, `docs/DATA-PROTECTION.md`, and `docs/COMPLIANCE-MAP.md` — **none
of which exist yet.** Most are scheduled for Phase 4. The README is not: session 1's stated
done-when includes "both badges render in the README", and there is no README, so that
criterion is unmet (`fieldnote-7zo`).

---

## What's next

### Session 5 — Generation route, guardrails, and headers

Read `docs/BUILD-GUIDE.md` session 5 in full before starting; this is a pointer, not a
substitute. The prompt is at `docs/prompts/session-5.md`. Budgeted at ~3.5 hours, and
**understated deliberately**: the eval-ordering resolution moves work forward into this
session, so an adversarial case is written alongside every guardrail built here. Expect it
to run long rather than discovering it mid-session.

A server-side route handler, prompt templates and guardrail rulesets as versioned modules,
per-person batching, and retry and truncation handling. Plus CSP, SRI, and strict security
headers asserted against a live response, and the single-egress check in CI, which catches
the careless case rather than the determined one and should be cited with that limit.

**Done when** drafts generate end to end with names tokenised in the API payload and
correct in the UI, a test asserts the headers on a real response, and the egress check goes
red when a second destination is added — verified by adding one temporarily.

**Two conflicts were resolved before this session starts**, both amended into the build
guide. Eval ordering: session 5 writes an adversarial case alongside each guardrail it
builds; session 7 builds the runner. Claim-bearing text: the library is session 9, so
everything claim-bearing is unmatched and session 5 blocks all of it — that is §4.2
working, observed early, not a defect to design around.

**The two pre-session gates, and where they stand.** The prompt carries them as stop
conditions.

1. *The capture surface has been used on a physical device, with `fieldnote-xjs`
   updated.* Literally met: it was used on an iPhone by the owner and by the
   representative, and the bead records that. Not met in the sense it was written for:
   nobody produced the finding the bead asks for — whether the layout is right for her,
   where she hesitates, what she reaches for that is not there. The bead stays open and
   says so. **Which reading governs is the owner's call, and it should be made before the
   session starts rather than by the session.**
2. *`docs/TESTING-ON-DEVICE.md` corrected with what actually happened on hardware.* Met
   by the PR carrying this handoff.

Four things earlier sessions hand it. Everything crossing to the model goes through
`createPseudonymizer` and then `assertPseudonymized`; the guard is an internal invariant,
so session 5 owns making a throw surface as a defect report rather than as a failure to
the representative. Token stability across a batch comes from reusing one pseudonymizer
instance. `fieldnote-q0h` — roles are not tokenised — should be decided before generation
is wired up. And `fieldnote-dx0` — a mangled clinical term reaches the model as fact — is a
decision the classifier has to make about clinical vocabulary in relational text, and it
should be made visibly and recorded in the guardrail version notes.

### Where outstanding work lives

Three places, deliberately. Do not duplicate between them.

**Beads — internal build state.** Findings, deferred decisions, open questions. 38
issues: 25 open, 9 closed, 4 deferred, with 13 ready and 12 blocked (`bd stats`). Run
`bd ready` for what is actionable and `bd blocked` for what is waiting and on what.
Session-container beads exist only to hang dependency edges from and are deferred so they
do not compete with real work. This handoff deliberately does not list them: a handoff that
copies the tracker drifts from it.

Eight are worth naming because they qualify claims made above. `fieldnote-n8z` — three
tools have written to the files that govern how the agent behaves, and no automated
control was added, deliberately, with four rejected options recorded. `fieldnote-q0h` —
role references identify people and the tokenizer does not see them, the largest remaining
hole in §4.1. `fieldnote-xjs` — the capture layout is unvalidated, and a hardware run is
not validation. `fieldnote-bdw` — narrowed this session to Safari storage durability
across the seven-day eviction window, with a cheap `navigator.storage.persisted()` check
recorded as the first step; it still blocks `fieldnote-tcq`, the retention decision.
`fieldnote-ech` — the denylist matches listed spellings only. `fieldnote-dx0` — the
clinical-vocabulary dictation class, new. `fieldnote-ijg` — nothing is deployed and the
representative can only use the app beside the machine serving it, new. `fieldnote-v2s` —
the private fork has no session in the build guide, new; the same defect class as
retention and the voice-profile intake, work the plan depends on that no session owns.

**GitHub issues — public record.** Anything a public reader should see. One open: **#11**,
migrating ESLint to flat config and upgrading `eslint-config-next` to 16.x. It is blocked
on a migration rather than a version bump. Dependabot PR **#27** is that upgrade arriving
again at a later patch; it should be closed the way #3 was, not merged.

**Session prompts — what was asked.** `docs/prompts/`, one file per build-guide session
with the prompt verbatim and a note on how it went. Read the relevant one before starting
a session. The between-session PRs, including #28 and this one, have no prompt file; that
is the convention, and it means their instructions live only in the PR bodies.

**ADRs — decisions.** `docs/adr/`, index at `docs/adr/README.md`. Records are immutable
once accepted: superseded by a new record when a decision changes, amended in place with
a dated note when a consequence is added. Three amendments are owed or worth considering.
When `fieldnote-bdw` resolves, ADR-0004 gains a dated note, because storage eviction is a
second residual risk on the availability axis beside the confidentiality risk it accepted.
ADR-0006's residual-risk section says the mangling evidence is five names; that is still
true of the name evidence, but the record does not know about the second failure class,
and whether to amend it is the owner's call. And the substance of the plan §2 conversation,
when it exists, likely belongs in an ADR rather than a §7 status line.

---

## How to work in this repo

- **Read the build guide session in full before writing prompts for it.** The guide is
  the source of truth for scope and for what "done" means. A session brief is a summary
  of it, and summaries drop the constraint that mattered.
- **Verify the guide's and the prompt's premises before building on them.** Session 3's
  instruction to port a validated prototype rested on an artifact that no longer existed;
  the CA fix arrived in a prompt describing work a previous session had already committed.
  A plan is written earlier than the repository it describes, and where the two disagree
  the repository wins and the document gets amended in the session that found it.
- **A control that is not tested is not a control, and one that reads as tested is
  worse.** Where something genuinely cannot be covered, say so in the file itself rather
  than letting a green suite imply otherwise.
- **Verify by running, not by reasoning.** Every hardware and TLS finding in this
  repository contradicted something a document said would happen. The standard is to
  demonstrate a control by removing it and watching something fail.
- **Check existence and ignore status separately.** `git check-ignore` is a pattern
  query: it reports a match whether or not the file exists.
- **The constraints in `CLAUDE.md` are not optional.** If a task requires violating one,
  stop and say so rather than finding a way around it. The constraint is the point.
- **Never `--no-verify`.** If the pre-commit hook fires, stop and show the output. Check
  `git config core.hooksPath` still reads `.husky/_` after any tool that installs hooks of
  its own, including every `bd` command.
- **`gh pr create`, never `--fill`.** `--fill` skips `PULL_REQUEST_TEMPLATE.md`, whose
  checkboxes carry the CLAUDE.md constraints.
- **Stage explicit paths.** Never `git add -A` after a tool has run. An unexpected
  modification to a governance file is a finding, not noise.
- **One session, one PR.** A finding that surfaces mid-session and is not blocking gets a
  bead, not a new branch. Work not attached to a session gets its own small PR.
- **Separate commits per logical change.** Merge with a merge commit rather than a
  squash: the commit history is part of the artifact.

---

## Known gaps in this document

Stated rather than smoothed over.

- **The capture layout has been used but not validated.** It was built from a
  four-sentence feature list, not ported from the validated prototype. It has now been
  used on hardware by the representative and it functions; nobody observed whether it is
  right for her. `fieldnote-xjs` stays open and session 5's first gate turns on which
  reading of "used" the owner accepts. Treat "capture works" here as "capture functions".
- **The iOS version of the hardware run is not recorded.** Two beads asked for it and the
  runbook has a place for it. Everything under *Verified on hardware* is true of one
  phone on one day, and the version should be added before it is cited elsewhere.
- **Storage durability across Safari's eviction window is untested**, because testing it
  means seven days without opening the app. `fieldnote-bdw` is now exactly this, and it
  gates the retention decision and an ADR-0004 amendment.
- **Nothing is deployed, and nothing about the deployed path is verified.** Every hardware
  result came over the LAN from the machine serving it. `fieldnote-6x5` (does the offline
  shell survive a Vercel build) and `fieldnote-ijg` (real use needs a deployment) are the
  same fact seen from two sides.
- **The private fork has no session and this handoff has no visibility into it.** Whether
  one exists or what state it is in is unknown here. `fieldnote-v2s` records the gap in
  the guide.
- **Nothing here has read the material in `private/`.** The file names come from a
  filesystem check, not from the contents.
- **The dictation evidence is two small samples.** Five surnames for the name class; one
  representative, one session, two terms for the vocabulary class. Both establish that a
  failure exists and what shape it has. Neither supports a rate, and the guide's amendment
  says so.
- **One observed dictation pair is deliberately not in the public documents.** It is an
  anatomical term that narrows the device category, which plan §7 as amended treats the
  same way as a product characteristic. The bead names the decision; the owner can
  overrule it.
- **The service worker update path has no automated coverage.** Verified manually, twice;
  `fieldnote-unp` has the procedure.
- **The backgrounded-tab e2e emulates `visibilitychange` rather than producing it**, and
  **`useDebouncedAutosave` has no unit test**; both are covered indirectly and the reasons
  are in the specs.
- **Plan §7 item 3 records a status with no substance.** It says the §2 conversation is
  resolved and nothing about what was described or approved. §2 gates the private build on
  the substance.
- **There is no automated control against a tool writing to the governance files.** The
  mitigation is a working agreement and it depends on whoever is staging actually reading.
  `fieldnote-n8z` has the four rejected options. Session 15 owes it a threat-model entry.
- **Role references are not pseudonymised.** `fieldnote-q0h`; the largest remaining hole
  in §4.1, to be closed before generation is wired to the boundary.
- **A name with neither a title nor a roster entry is still missed.** The structural rule
  closes the common case, not the general one.
- **Session-to-PR attribution before session 2 is partly inferred** from commit messages;
  the build guide does not record which PR closed which session.
- **Hours in the build guide are estimates, not measurements.** Nothing here records
  actual time spent.
