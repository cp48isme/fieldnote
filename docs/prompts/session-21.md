# Session 21 — The private repository, deployed

**Process note.** Guardian wrote this prompt — the separate Claude instance that reviews
the work and drafts the prompts, with no shared context and no direct view of the
repository. Several additions arrived during the session and are in **Additions sent
mid-session** below.

**On what is missing from this file.** The private repository's name, the Vercel
project's name, the production domain, the generated deployment URL, and the branch URL
were all given to the working instance in the session and appear nowhere here, in the
commits, or in any bead. Where the prompt named one it is written as `<private>` or as
"the production domain". That is the session's ground rule, not an omission.

---

Session 21 — the private repository, deployed. Two repositories: the public one,
cp48isme/fieldnote, and a new private one the owner names. Stops means stops.

## Ground rules
- Every earlier rule stands: the private-material sentence, no approval language, no
  person named ("the representative").
- The private repository's name, URL, the Vercel project's name, and every deployment
  URL or domain appear nowhere in the public repository, its commits, PRs, or beads.
  Public artifacts say "the private repository" and "the private deployment".
- You never see a secret. The model API key, the access key, its hash, and the private
  term list are entered by the owner, in the owner's terminal or Vercel's dashboard.
  Never ask the owner to paste one into this session. If output would show one, redact
  it before printing.
- Two public PRs this session, deliberately: Part A's code merges first, because the
  private repository is created from public main; Part F records what happened.
- Owner steps are marked OWNER. At each, print the exact steps, stop, and wait for the
  owner's "done" before continuing.

## Part 0 — Verify
main at 689ef9b or a descendant; tree clean; the local-only bead checks before the first
bead command and after the last. `lsof -iTCP:3000` clear before any e2e run.
Read: docs/adr/0012-deployment-on-vercel.md in full; docs/HANDOFF.md; the guide's
Deployment section; src/lib/generation/private-terms.ts; src/app/api/generate/route.ts;
src/app/settings/page.tsx; scripts/build-service-worker.mjs; the beads fieldnote-6x5,
fieldnote-ijg, fieldnote-v2s, fieldnote-bdw, fieldnote-cjs.

## Part A — Two public changes (branch feat/session-21-deploy-prep, PR, merge)

1. The private term list from the environment. On Vercel there is no
   .guardrail-terms.local, so the private-term rule is silently inactive. The route
   must also accept the list from an environment variable,
   FIELDNOTE_GUARDRAIL_TERMS, one term per line, Production only. The file still wins
   when present, so local behaviour is unchanged. The startup log keeps reporting a
   status and a count, never a term, and says which source it used.
   BEFORE WRITING CODE: private-terms.ts is under src/lib/generation/, which is watched.
   If the change can be made without editing any watched file (for example, reading the
   variable in the route and passing the terms to a builder that private-terms.ts
   already exports), do that. If it cannot, stop and report which export would be
   needed; do not edit a watched file.
   Tests: variable set, file set, both set (file wins), neither (inactive, said so),
   and the log carries a count and a source and never a term.

2. Persistent storage. On startup, when navigator.storage.persist exists, request it
   once and record nothing about the result anywhere but the settings screen, which
   gains a read-only line showing what navigator.storage.persisted() reports:
   "Storage on this device: persistent" or "not persistent" or "unknown". No data
   layer change. Failure never blocks startup.
   Tests: unit, with persist present, absent, and throwing; e2e, the settings line
   renders one of the three states.

Watched-path check against the diff before the PR: must be none. Unit and e2e green
(a full run, or only persistence.spec.ts:92 failing and passing on isolated re-run).
Commit, push, gh pr create (never --fill), wait for all four checks with the eval gate
skipping, merge with a merge commit, pull main.

## Part B — Create the private repository

OWNER: choose the private repository's name. Tell me only that it is chosen, then run,
in your own terminal: `gh repo create <name> --private` with no other members.
Reply "done" and give me the name in this session only, so I can clone it. I will not
write it into the public repository.

Then, in a separate directory outside the public clone (for example ~/dev/<name>):
- Clone the new empty private repository; add the public repository as remote
  `upstream`; fetch; reset the private main to upstream/main; push.
- Confirm on GitHub via gh: visibility private, collaborators none.
- Disable GitHub Actions on the private repository (`gh api -X PUT
  repos/<owner>/<name>/actions/permissions -F enabled=false`) and show the result. The
  public repository runs the tests; this one is a deployment source.
- Do not run bd init or any bd command in the private clone. Do not copy .denylist.local
  or any private file into it.
- Report: the private repository's HEAD SHA equals public main's; visibility; Actions
  disabled; `git remote -v` with the private URL redacted.

## Part C — Vercel (OWNER, with a checklist)

Print this checklist for the owner and stop until "done":
1. Vercel is on the Pro plan with no other members.
2. Add New → Project → import the private repository. Framework: Next.js. Build
   command: leave as the project's own (`pnpm build`, which also writes the service
   worker's precache manifest). Do not deploy yet if Vercel offers to.
3. Settings → Deployment Protection: Standard Protection, method Vercel Authentication.
4. Settings → Vercel Toolbar: Off for Preview and for Production.
5. Do not enable Web Analytics or Speed Insights.
6. In your own terminal, in the private clone: `node scripts/generate-access-key.mjs`.
   Save the key in your password manager for the representative's device. Keep the hash
   for the next step. Close the terminal.
7. Settings → Environment Variables, each scoped to Production only:
   - ANTHROPIC_API_KEY — the production key from your password manager.
   - FIELDNOTE_ACCESS_KEY_HASHES — the hash from step 6.
   - FIELDNOTE_GUARDRAIL_TERMS — the private term list, one per line, typed from your
     own copy.
8. Deploy production. Reply "done" with the production domain, in this session only.

## Part D — Verify the deployment from outside

Against the production domain, and report raw output with no secret in it:
- `curl -sI /` : the CSP, X-Robots-Tag noindex, HSTS, and the other static headers.
- `/robots.txt` disallows everything.
- fieldnote-6x5: `/sw.js` returns 200 as JavaScript, and `/precache.json` returns 200
  as JSON listing assets. If precache.json is a 404, stop: that is the silent failure
  the bead describes.
- POST /api/generate with Content-Type text/plain → 415.
- POST /api/generate as JSON with no cookie → 401 with "This device is not
  authorised." (not "not accepting callers", which would mean the hashes variable did
  not reach Production).
- A generated production deployment URL (not the domain) and any preview URL require a
  Vercel login: show the response status and redirect target.

OWNER: open Vercel → the project → Logs, find the generation route's startup line,
and report only its status, count, and source for the private terms. Stop until
reported. If the status is not "loaded" with source "environment", stop.

## Part E — The device check (OWNER, on the representative's phone)

Print these steps and stop until the owner reports results:
1. In Safari, open the production domain (not a generated URL). Add to Home Screen.
2. Open the installed app. Settings: enter the access key. Note the storage line.
3. Create a test event with made-up names only. Add a person, dictate a note, draft.
   Confirm a draft appears and the review gate works.
4. Airplane mode on; kill the app from the switcher; reopen from the icon; confirm the
   note is present and capture works. Airplane mode off.
5. Kill and reopen the app; draft again without re-entering the key. Report whether the
   key survived.
6. Delete the test event.
7. Report: iOS version; storage line text; draft yes/no; offline yes/no; key survived
   relaunch yes/no; anything odd.

## Part F — The record (public repository, branch docs/session-21-deployed)

- docs/BUILD-GUIDE.md: session 21 amended on completion, stating what was done and
  found, with no private names, URLs, or domains.
- ADR-0012: a dated amendment only if a fact in it changed on contact with the real
  platform (for example, the storage line, the cookie on iOS, the precache). Otherwise
  none.
- docs/THREAT-MODEL.md and docs/DATA-PROTECTION.md: only where a statement is now
  wrong; say which.
- Beads, with the checks around them: close fieldnote-6x5 with what Part D showed;
  close fieldnote-ijg if the deployment is reachable and works from the device; close
  fieldnote-v2s naming the guide's Deployment section; append the device results,
  including persisted() and the cookie, to fieldnote-bdw, dated, with the iOS version.
  fieldnote-cjs: append whether the proxy failure is moot on the deployment, and close
  it only if Part E showed the stored copy opening offline.
- Handoff regenerated from the template; changelog line; docs/prompts/session-21.md with
  this prompt, the process note that Guardian wrote it, and how it went, with every
  private name, URL, and domain left out.
- Grep the branch for the private repository's name and the production domain before
  committing; zero hits or stop.
- Watched-path check (none), unit and e2e green, push, PR, four checks, merge.

## Scope guard
No retention code (session 22). No change under a watched path. No new dependency.
Nothing committed to the private repository beyond what upstream main contains.

## Stop conditions
A premise here does not match the repository or the platform; a watched file would
change; the precache manifest is missing on the deployment; the hashes or the term
list did not reach Production; any secret would appear in output; a private name, URL,
or domain would enter the public repository.

## Report back, raw output
1. Part A: the watched-path check, the diffs, test names and counts, the PR, the four
   checks and the skip line, the merge commit.
2. Part B: the private HEAD equals public main; visibility; Actions disabled.
3. Part D: every check's output, redacted.
4. The owner's reported log line and device results, as reported.
5. Part F: the diffs, bd show for each bead touched, the grep for private names and
   the domain (zero hits), the PR, the checks, the merge commit.
6. The local-only bead checks before and after.
7. Anything that met a stop condition.

---

## Additions sent mid-session

**Before Part B**, the owner asked, correctly, to confirm the public clone's remotes
still showed only `origin`, since the private repository had been created from inside
that directory. They did: one remote, the public one, and nothing in the local
configuration referring to the new repository.

**Before filling in the term list**, the owner asked whether the private-term rule is
applied to text the model copied from an approved passage, or whether passages are
exempt as they are in the client-side ruleset, reasoning that a product name on the list
would otherwise gap every draft that quotes approved content correctly. They are exempt:
the route holds passages out with `protectApproved` before its one rule runs and splices
them back after. The answer came with the limit attached — the exemption is whole
passage or nothing, so a reworded quotation is not held out — and with the observation
that the existing test proves the round trip but runs with no list loaded, so nothing
exercised a live term against a passage.

**The owner then asked for a list of terms to include.** The answer gave the categories
and the cautions and named no term, because the working instance does not know them and
the arrangement is that it never does.

**After the redeploy**, the owner supplied the generated production URL and the branch
URL for the protection check, noted that no preview deployment exists so that case is
untested, and added two items to Part F: the unit test described below, and the Speed
Insights finding as a dated ADR-0012 amendment.

> Add to Part F: a unit test in tests/unit/generate-route.test.ts that sets
> FIELDNOTE_GUARDRAIL_TERMS to a synthetic term, has the mocked model return an approved
> passage containing that term copied exactly plus the same term in the model's own
> sentence, and asserts the passage survives intact while the model's own use is flagged
> with the private-term rule id. No watched file changes. Also record the Speed Insights
> route as a dated ADR-0012 amendment, as you proposed.

**With the Part E results**, the owner added that the model key had been replaced on
2026-09-22 in the same dedicated workspace and the deployment redeployed, to be recorded
without any key, URL, or amount; and that the two interface findings were to be recorded
rather than fixed in this session.

---

## How it actually went, for whoever reuses this

**Part A's stop condition did not fire, and the reason is worth keeping.** The prompt
was right that `private-terms.ts` is watched and right to ask whether the change could
be made without touching it. It could: that module already exports `parseTerms` and
`privateTermRule`, so a resolver composing them lives outside the watched directory and
the eval gate skipped, confirmed on the real run. The cost is that the resolver sits
somewhere its subject does not, and the only honest thing to do about that is say so in
its header, which it does. Whether that trade is right is the owner's to revisit; the
alternative is one live eval run per change to that directory.

**Everything the prompt asserted about the repository held.** `main` was at `689ef9b`,
the five beads existed as described, and every file it named was where it said.

**Part D found one thing nobody expected, and it was not a stop.** The deployment
answers on Vercel's Speed Insights script path with a real script, although the product
is not enabled — the platform adds that route to deployments by default, as its own
documentation says. Nothing collects: the served page references neither product, every
script tag on it is a same-origin chunk, and the package is not installed. ADR-0012 had
said these were off by construction, which remains true of collection and was silent
about the route, so the amendment records it. The general lesson is the one §5.5 already
teaches: a platform's defaults are a claim to check, not a property to assume.

**Part E found the deployment's one real failure, and it was outside this repository.**
The first draft attempt returned a 500 naming the model key variable, which had not
reached Production. The owner replaced the key in the same dedicated workspace and
redeployed, and drafting worked. Worth noting for the next deployment: the two
environment variables this application refuses without are checked at different points,
and only one of them is verifiable from outside without a valid key — the access hashes
announce themselves through which 401 message the route returns, and the model key does
not announce itself until someone with a key drafts. The device check is what found it.

**Two interface findings, recorded and not fixed.** The settings link renders only once
an event exists, so a fresh install cannot reach settings first; and a saved key
produces no confirmation, because the screen cannot read a cookie scoped to `/api`.
Neither is a security defect. Both are the difference between a control that works and a
control someone can use in a car park, and they are `fieldnote-cno`.

**What the device settled, and what it did not.** Settled: persistent storage is granted
on the installed app, the access cookie survives a relaunch, the offline shell holds on
the deployment, and the precache manifest survives a Vercel build. Not settled, and
still the whole of `fieldnote-bdw`: the seven idle days, which only waiting tests, and
behaviour under real storage pressure. One device, one run, each.

**Spend.** Two model calls, both from the device during the check, plus a third that
failed on the missing key. No eval run: no watched path changed in either pull request.
