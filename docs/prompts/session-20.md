# Session 20 — Deployment decision and route controls

**Process note.** Guardian wrote this prompt — the separate Claude instance that reviews
the work and drafts the prompts, with no shared context and no direct view of the
repository. Two things arrived after it and are in **Additions sent mid-session** below:
the owner's redesign of Part 2b, after the session stopped on a watched path, and the
owner's decision on the provider's retention.

---

Session 20 — Deployment decision and route controls. Public repository, cp48isme/fieldnote.
Branch feat/session-20-deployment from main after Part 0. Local commits only; do not push,
do not open a PR, do not merge until the owner's reviewer has read the branch.

## Ground rules
- The rule on the private material binds every artifact: public documents say only that
  a term held out of the public documents was exposed for a day in 2026-09 and that a
  history the project does not control retains it. Cite docs/THREAT-MODEL.md §5.5 and
  §6; never paraphrase them.
- No document, bead, commit, or PR says anything about an organisational review,
  approval, sign-off, manager, or employer permission gating the private build.
  Product controls (approved content, the draft review gate) are unaffected.
- No person is named. The user of the private build is "the representative".
- The private repository and its deployment are named only as "the private repository"
  and "the private deployment". No URL, project name, domain, or account for either
  appears in this repository.
- Stops means stops. On a stop condition, write the report and wait.

## Part 0 — Verify, then triage Dependabot (on main)
Verify: main at 5daadf0 or a descendant containing it; tree clean; the local-only bead
checks (`bd config get backup.git-push` false, `git ls-remote origin 'refs/dolt/*'`
empty, `git config core.hooksPath` is `.husky/_`), before the first bead command and
after the last.

Dependabot:
- #50 (GitHub Actions pins) and #51 (npm minor and patch): show `gh pr diff` for each in
  full. Stop if either changes anything beyond version pins in .github/workflows/ or
  versions in package.json and pnpm-lock.yaml, or if the lockfile adds packages not
  named in the PR body. If both are clean and green, merge each with a merge commit, one
  at a time, waiting for main's CI between them.
- #52 (eslint-config-next 16): close it with the comment "Tracked as #11; the flat-config
  migration has to land first." Do not merge.
Then `git pull` and branch.

## Read before starting
CLAUDE.md; docs/HANDOFF.md; docs/BUILD-GUIDE.md from Phase 4 to the end;
docs/THREAT-MODEL.md §2, §3.3, §6; docs/DATA-PROTECTION.md §3.3, §7, §8; SECURITY.md;
ADR-0001, ADR-0004, ADR-0005, ADR-0009; src/app/api/generate/route.ts;
src/lib/generation/client.ts; src/proxy.ts; tests/unit/generate-route.test.ts;
tests/e2e/headers.spec.ts; scripts/evals-watched-paths.mjs.
Beads, with bd show: fieldnote-9n1, fieldnote-ijg, fieldnote-6x5, fieldnote-v2s,
fieldnote-n9l, fieldnote-m8t, fieldnote-cjs, fieldnote-iox.

## Part 1 — ADR-0012: Deployment on Vercel

Written by hand in the register of the other ADRs, with rejected alternatives. Before
writing any claim about Vercel, read Vercel's current documentation and cite the page
and the date read for each: deployment protection and which environments each plan can
protect; environment variables scoped per environment; function regions; runtime log
retention; Web Analytics, Speed Insights, and the Vercel Toolbar and how each is turned
off; the plan tiers' terms of use. If the documentation contradicts a decision below,
stop and report; do not choose a substitute.

Decisions to record:
1. The private build deploys first, from the private repository, to its own Vercel
   project under the owner's personal account, with no other members. The public build
   is not deployed by this decision.
2. Preview and every non-production deployment protected by Vercel's deployment
   protection. The model API key is set for the Production environment only, so a
   preview cannot call the model even if reached.
3. Web Analytics, Speed Insights, and the Vercel Toolbar off. The Toolbar injects script
   into preview deployments; say whether the content security policy would block it and
   test that claim, not reason it.
4. One function region, named in the ADR with the reason for choosing it.
5. Noindex: an `X-Robots-Tag: noindex, nofollow` header on every response, set in
   src/proxy.ts beside the other headers, and a robots.txt that disallows everything.
6. The route's caller control (Part 2) and the cost ceiling: a monthly spend limit on the
   model API key, set by the owner in the provider's console. The ADR says it is an
   owner action outside this repository, and the handoff lists it as owed.
7. What the ADR does not settle: the service worker on a Vercel build (fieldnote-6x5,
   verified in session 21 against a real build), and the representative's device
   settings (fieldnote-m8t).
8. Consequences: Vercel becomes a party the request passes through and where function
   logs live. The route logs metadata only; say so and cite the test.

Rejected alternatives to write up: Vercel's own authentication for the representative
(requires a Vercel account on her device); a password-protection add-on, if the docs
show one, with its cost; an in-memory rate limit as the cost control (per-instance on
serverless, so not a ceiling); no caller control, relying on the URL being unguessable.

Update docs/adr/README.md's index and summary.

## Part 2 — The route controls (fieldnote-9n1)

a. Content type: the route refuses a body whose Content-Type is not application/json,
   before parsing, with 415 and a metadata-only log line. Tests: accepted, refused.

b. Caller key: a per-device access key.
   - The server holds one or more key hashes in an environment variable, never the keys.
     The route compares the SHA-256 of the presented key against them in constant time
     and refuses with 401 before reading the body when none match or none is presented.
     With the variable unset, the route refuses every request and logs that it is
     unconfigured, naming the variable and nothing else. It never falls back to open.
   - The client sends the key in an Authorization header. The key is entered once in
     the app on a small settings screen, stored on the device through the data layer
     (a new settings field is a schema version and a migration with a test), and never
     logged or sent anywhere else.
   - A script under scripts/ generates a key and prints the key once and its hash, for
     the owner to install. The key is never written to a file.
   - Tests: no header, wrong key, right key, unset variable, the log carrying no key
     or hash, and the comparison being constant-time (assert the function used, not
     timing).
   Classify the new settings field in schema.ts with its why. Cite ADR-0004's
   position: at rest the key has the same protection as everything else on the device.

c. Rate limit: none in code. The ADR's cost ceiling is the spend limit (Part 1, item 6).
   The route's behaviour when the provider refuses for rate or spend is already tested;
   confirm which test and cite it.

Before writing any code, check scripts/evals-watched-paths.mjs against every path you
will change and report which are watched. If src/lib/generation/client.ts is watched and
this changes it, the eval gate will run live on the PR: report it before building and
wait.

## Part 3 — Documents and tracker
- docs/THREAT-MODEL.md: §3.3's spoofing row cites the caller key and its test in place
  of "a deployment question with no session"; §6 unchanged except where an item is now
  wrong, and say which.
- docs/DATA-PROTECTION.md §7: the hosting paragraph names Vercel as decided (ADR-0012)
  and not yet deployed, with the logs and region facts from the ADR.
- docs/BUILD-GUIDE.md: after the private-fork section, a new section "Deployment" with
  three entries: session 20 (this, amended on completion), session 21 (the private
  repository created from the public one as a new private repository, not a GitHub
  fork; its Vercel project under ADR-0012; the key installed; fieldnote-6x5 verified on
  the real build; a device check against the deployed origin), and session 22
  (fieldnote-iox, retention, as decided 2026-09-17). Hours as estimates. Do not
  renumber anything.
- Beads: close fieldnote-9n1 with a reason naming ADR-0012 and the tests. Append to
  fieldnote-ijg and fieldnote-v2s that sessions 21 and 22 now own their remaining work.
  Open nothing else unless a stop condition requires it, and then only in the report.
- Handoff regenerated from the template with the previous one closed; it names the
  owner actions still owed: the zero-retention confirmation (fieldnote-n9l), the spend
  limit, and auto-lock on the representative's device (fieldnote-m8t). Changelog line.
  docs/prompts/session-20.md with this prompt verbatim, the process note that Guardian
  wrote it, and how it went.

## Scope guard
No deployment, no Vercel project, no private repository: those are session 21. No
retention code. No change to the pseudonymizer, the ruleset, or the prompt template. No
new dependency without an ADR first; hashing uses Web Crypto.

## Stop conditions
A premise here does not match the repository, the tracker, or Vercel's current
documentation. A change would put a watched path in the diff. A section cannot be
written without breaking the ground rules. A live weakness not in a bead: report it
only.

## Done when
ADR-0012 exists with every Vercel claim cited and dated; the route refuses a wrong
content type and a missing or wrong key, and refuses everything when unconfigured, each
tested; the key is entered once and stored through the data layer with a migration;
noindex is asserted in tests/e2e/headers.spec.ts against a live response; unit and e2e
green (a full run, or only persistence.spec.ts:92 failing and passing on an isolated
re-run, citing fieldnote-ccf); fieldnote-9n1 closed; the guide, handoff, changelog, and
prompt file written; all local.

## Report back — raw output
1. Part 0: the two diffs' summaries, the merge commits, #52's closing comment.
2. Verified versus assumed, including each Vercel claim with its source and date.
3. ADR-0012 in full.
4. The watched-path check, before any code.
5. `git diff main --stat`; the diffs of route.ts, proxy.ts, schema.ts, the migration,
   and the new script in full.
6. Test names added, and unit and e2e counts.
7. The bead checks before and after; bd show fieldnote-9n1 after.
8. `git log --format='%H%n%B' main..HEAD`; `git status`.
9. The denylist over the diff and commit messages, match counts only.
10. `git ls-remote --heads origin feat/session-20-deployment` (must be empty).
11. Anything that met a stop condition.

---

## Additions sent mid-session

### The redesign of Part 2b, after the stop

The session stopped before writing any code, on the watched-path condition: Part 2b's
`Authorization` header required changing `src/lib/generation/client.ts`, which is under
`src/lib/generation/` and therefore watched. The owner answered:

Session 20 — the owner's answer to your stop. Resume on the redesign below.

The stop was correct. Do not narrow the watched paths, do not split the PR, and do not
accept a live eval run. Part 2b is redesigned so that src/lib/generation/client.ts does
not change.

#### Part 2b, replaced: the caller key in an HttpOnly cookie

- A settings screen with one field. It submits as a plain HTML form, method POST, to a
  new same-origin route, src/app/api/access/route.ts. No fetch, no XMLHttpRequest, no
  script-driven request.
- That route: refuses anything but a POST with an application/x-www-form-urlencoded body
  (415 otherwise); hashes the submitted key with SHA-256; compares against the hashes in
  the environment variable in constant time; on a match, sets a cookie `HttpOnly;
  Secure; SameSite=Strict; Path=/api`, with a Max-Age stated in the ADR, whose value is
  the key, then redirects 303 to the app; on no match, redirects 303 to the settings
  screen with a failure flag and sets nothing. With the variable unset it refuses and
  logs that it is unconfigured, naming the variable and nothing else. It logs metadata
  only: never the key, never a hash.
- The generation route reads the cookie, applies the same hash-and-compare, and refuses
  with 401 before reading the body when it is missing or wrong. With the variable unset
  it refuses everything. It never falls back to open.
- A way to clear the key: the settings screen offers "forget this device", which POSTs
  to the same route with an action that expires the cookie.
- No schema change, no migration, no settings field. Nothing about the key is stored in
  IndexedDB or any script-readable storage.
- The key script under scripts/ is unchanged from the original Part 2b.

Tests, unit: the access route (right key sets the cookie with every attribute asserted;
wrong key sets nothing; wrong content type; unset variable; forget expires the cookie;
logs carry no key or hash); the generation route (no cookie, wrong cookie, right cookie,
unset variable). End-to-end: in a real browser, the settings form sets the cookie,
generation succeeds against the existing route mock, and document.cookie does not
contain the key.

#### Two consequences to write, not discover
1. ADR-0012 and docs/THREAT-MODEL.md §2 and §3.3 name the access route as a second
   same-origin request the page makes, by a form submission, carrying the key and
   nothing about any attendee. It is not a new destination; the model egress is
   unchanged. Say plainly that tests/unit/single-egress.test.ts greps for fetch and
   similar calls and would not see a form submission, and state what does bound it:
   form-action 'self' in the policy, asserted in tests/e2e/headers.spec.ts.
2. Whether the cookie survives in the installed app on iOS is unverified. The ADR says
   so and names session 21's device check as where it is verified. If the cookie is
   lost, she re-enters the key and nothing else is affected.

#### Also
- fieldnote-m8t is closed. The handoff cites docs/THREAT-MODEL.md §5.6 for auto-lock,
  not an open bead.
- Before writing code, re-run the watched-path check against the new file list, which
  must include src/app/api/access/route.ts and the settings screen, and report it. If
  anything is watched, stop.

Every other part of the session prompt stands. Report back as it specifies.

### The provider's retention: decided, not unverified

Session 20 — an addition from the owner, dated 2026-09-21. Fold it into this branch.

The owner has decided that zero data retention is not in place on the account the API
key belongs to and will not be requested now. The provider's standard commercial
retention policy applies.

1. Read the provider's standard commercial retention policy and its API data retention
   page. Record what each says about how long API inputs and outputs are retained,
   quoting no more than a short phrase, with the date read. If either cannot be fetched,
   record the URL and say the period was not read; do not state a period from memory.
2. Close fieldnote-n9l with this reason, filling in the bracket from step 1:
   "Decided by the owner 2026-09-21: zero data retention is not in place on this account
   and will not be requested now. The provider's standard commercial retention policy
   applies: [period, as the policy states it, and the date read]. The documents state
   this as a fact, not as an unverified arrangement."
   Run the local-only bead checks before and after, as the session prompt requires.
3. Documents, on this branch:
   - docs/THREAT-MODEL.md §3.3, the information-disclosure row, and §6, the provider
     retention item: replace "nothing here verifies it" and "unverified" with the fact:
     zero data retention is not in place; the standard commercial policy applies, with
     the period and the date read; fieldnote-n9l, closed.
   - docs/DATA-PROTECTION.md §5 ("What is not minimised") and §7 ("What is not
     verified"): the same fact, in the same words. §7's bullet heading becomes "What the
     provider retains", not "What is not verified".
   - Plan §4.1 pairs pseudonymization with zero-retention configuration. Do not rewrite
     it; add one dated line beneath the paragraph.
   - Session 17's entry in the handoff: the compliance map maps the provider's retention
     as the standard policy, with the period, not as zero retention.

---

## How it actually went, for whoever reuses this

**The session stopped once, before writing any code, and the stop was the right call.**
Part 2b put the caller key in an `Authorization` header, which meant editing
`src/lib/generation/client.ts` — the only permitted network call site, and inside
`src/lib/generation/`, which the eval gate watches. There was no way around it: the
single-egress test allows exactly two call sites, so the header had to go in the watched
file. Building it would have made the adversarial suite call the live model to test a
prompt and a ruleset nobody had touched. The session reported the watched-path check and
waited. The owner's redesign moved the key into an `HttpOnly` cookie set by a plain form
post, which changes no watched path and is better on its own terms: the key is now in no
script-readable store at all.

**Every other premise held.** `main` was at `5daadf0`; the eight beads existed as
described, though `fieldnote-m8t` is closed rather than open, which the owner's addition
confirmed; every file, test, and script the prompt named was where it said.

**Vercel's documentation contradicted nothing, and decided one thing the prompt left
open.** Hobby permits non-commercial personal use only, and the fair use guidelines
define commercial usage to include a tool used for the financial gain of anyone involved,
naming a paid employee explicitly. A representative's work tool is commercial usage on
that definition, so the plan is Pro. That is not a contradiction of "the owner's personal
account, with no other members" — a personal account can be on Pro — but it is a cost the
prompt did not anticipate, and the ADR states it.

**One prompt instruction could not be followed as written, and the ADR says why.** Item 3
said to test whether the policy would block the Toolbar. The first attempt added a
`vercel.live` script with `page.evaluate` and found no violation — correctly, because
`'strict-dynamic'` deliberately allows a script that already passed the nonce check to
load further scripts. Injecting from an evaluated context tests the case the policy
allows. The test now puts the tag into the served HTML, which is parser-inserted and
needs its own nonce, and that is blocked with a reported violation. The distinction is in
the ADR, because "the CSP blocks the toolbar" is true only of one of those two shapes.

**Part 0 went as prescribed, with one step the prompt did not mention.** Both Dependabot
pull requests were behind `main` after the session 16 merge, and branch protection
requires up-to-date branches, so each needed its branch updated before it could merge.
The diffs were re-read after the update and were unchanged. The action pin in #50 was
verified rather than trusted: the `v4.38.0` annotated tag dereferences to exactly the
commit the pull request sets. #51's lockfile was checked for the §5.3 failure class and
was a clean 31-for-31 swap with no new package names.

**Two things the end-to-end suite found that reasoning had not.** A redirect built from
`request.url` resolved to `localhost` while the request had arrived at `127.0.0.1`, which
put the cookie on a different origin from the app; the fix is a relative `Location`. And
a stale server from an earlier session was still listening on port 3000, so Playwright
reused it and the whole suite ran against a build predating the branch — exactly what the
config comment and the handoff warn about, and the reason the first run was red.

**Decisions made in the session rather than read.** The access route lives at
`/api/access` so the cookie's `Path=/api` covers it and the generation route and nothing
else, which also means the settings page cannot see whether a key is set; the page's copy
says what entering a key does rather than what the state is. The comparison is called
through the `node:crypto` namespace rather than a named import, because a named import
was not observable to the test that asserts `timingSafeEqual` is the function used. Every
configured hash is compared even after one matches, so timing does not say which matched.
`vercel.json` carries the region, because a decision about where functions run that lives
only in prose is a decision nothing enforces.

**Spend.** $0. No path under `scripts/evals-watched-paths.mjs` changed, which was the
point of the redesign.
