# ADR-0012: Deployment on Vercel, and who may call the generation route

- **Status:** Accepted
- **Date:** 2026-09-21
- **Deciders:** cp48isme (owner)
- **Amended:** 2026-09-22, session 21, on contact with the real platform. The decision is
  unchanged; five facts in it are now observed rather than expected.
  - **The Speed Insights collection route ships whether or not the product is enabled.**
    Decision 3 says these are off by construction because the packages are absent, and
    that remains true of collection: the served page references neither product and every
    script tag on it is a same-origin chunk. But the deployment answers 200, with a real
    script, on Vercel's Speed Insights script path, which Vercel's own quickstart says is
    added to deployments automatically. The Web Analytics script path and the vitals
    collection path both return 404. So the absent dependency is the control, as the
    decision said; what the decision did not anticipate is that the platform's route
    exists anyway, which a reader checking the deployment would otherwise find alarming.
  - **The cookie survives in the installed app on iOS.** *Consequences* listed this as
    unverified. On 2026-09-22, iOS 26.6.2, the installed app drafted after being killed
    and reopened without the key being entered again.
  - **Persistent storage is granted.** The application now asks once at start-up, and the
    browser answered persistent on the installed app. `fieldnote-bdw`; the seven-day
    window and storage pressure are still unobserved.
  - **The service worker's precache survives a Vercel build.** `fieldnote-6x5`, which
    item 7 left open: the deployment serves `/sw.js` as JavaScript and `/precache.json` as
    JSON with thirty same-origin entries, and the offline shell held on the device.
  - **Which production URL she installs from**, also item 7: the project's production
    domain. The generated production URL and the branch URL both redirect to a Vercel
    login under Standard Protection, so neither is installable by her, which is the
    intended shape rather than a surprise.

## Context

The application runs for the representative only while she is standing near the machine
serving it: a production build over HTTPS on a Mac mini on the same wireless network,
which is a test rig and not a deployment (`fieldnote-ijg`). Real use is capture at an
event, in a car park, from an origin that exists when the mini does not. Plan §5 names
Vercel as the target and no session has deployed anything.

Two things have to be decided before anything is deployed, and they are one decision
because each depends on the other.

**Where it runs, and what the platform does with it.** A hosted origin adds a party the
request passes through, a place function logs live, and a set of platform features that
are on or off by default and that this project has opinions about.

**Who may call the generation route.** The route is served on the same origin as the
page and holds the model API key. On the LAN rig, "who may call it" is answered by the
network. From a hosted origin it is answered by nothing: the route would accept any
request that found it. `fieldnote-9n1` records the three controls it needs — caller
authentication, a rate limit, and a content-type check — and blocks `fieldnote-ijg`
because they are preconditions of hosting.

**Every claim about Vercel below was read from Vercel's documentation on 2026-09-21**,
and each is cited with its page. Where the documentation decided something rather than
confirming it, the decision says so.

## Decision

### 1. The private build deploys first, from the private repository, to its own project

The private build is what the representative needs, and it is the build that carries
real configuration. It deploys from the private repository to a Vercel project of its
own, under the owner's personal account, with no other members: fewer people with access
to a deployment holding real material is the whole point of ADR-0001's split.

**The public build is not deployed by this decision.** It is a reference implementation
read on GitHub. Nothing here stops a later session deciding otherwise; this one does not.

**The plan is Pro, not Hobby, and that is a constraint rather than a preference.** The
Hobby plan "restricts users to non-commercial, personal use only"
([`/docs/plans/hobby`](https://vercel.com/docs/plans/hobby), read 2026-09-21), and the
fair use guidelines define commercial usage as "any Deployment that is used for the
purpose of financial gain of **anyone** involved in **any part of the production** of the
project, including a paid employee or consultant writing the code", with "All commercial
usage of the platform requires either a Pro or Enterprise plan"
([`/docs/limits/fair-use-guidelines`](https://vercel.com/docs/limits/fair-use-guidelines),
read 2026-09-21). A tool a representative uses to do her job is commercial usage on that
definition. A personal account on the Pro plan satisfies both this and the
no-other-members decision above.

### 2. Preview and every non-production deployment is protected; the model key is Production only

**Protection.** Vercel's **Standard Protection** scope "[p]rotects all deployments
**except** production domains", and it can be combined with **Vercel Authentication**,
which "[r]estricts access to only Vercel users with suitable access rights"
([`/docs/deployment-protection`](https://vercel.com/docs/deployment-protection), read
2026-09-21). Both are "Included" on Hobby, Pro, and Enterprise
([`/docs/deployment-protection/usage-and-pricing`](https://vercel.com/docs/deployment-protection/usage-and-pricing),
read 2026-09-21), so this costs nothing. Standard Protection with Vercel Authentication
is the configuration: every preview and every non-production URL requires a Vercel
account with access to the project, which is the owner and nobody else.

**Production is deliberately not protected by Vercel**, because the person who uses it
has no Vercel account and should not need one. Who may use production is answered by
decision 6 instead.

**The model key is set for the Production environment only.** Vercel lets each
environment variable choose its environments — "For each Environment Variable, you can
select one or more Environments to apply the Variable to", listing Production, Preview,
custom environments, and Development
([`/docs/environment-variables`](https://vercel.com/docs/environment-variables), read
2026-09-21). With `ANTHROPIC_API_KEY` set for Production alone, a preview deployment
cannot call the model even if someone reached it: the route refuses, naming the variable,
which is the behaviour `tests/unit/generate-route.test.ts` already covers. Two independent
things therefore have to fail before a preview spends money.

`FIELDNOTE_ACCESS_KEY_HASHES` (decision 6) is set for Production only for the same
reason.

### 3. Web Analytics, Speed Insights, and the Vercel Toolbar are off

**Web Analytics and Speed Insights are off by construction, not by a setting.** Each
requires installing a package and rendering a component: `@vercel/analytics` with an
`Analytics` component
([`/docs/analytics/quickstart`](https://vercel.com/docs/analytics/quickstart), read
2026-09-21) and `@vercel/speed-insights` with a `SpeedInsights` component
([`/docs/speed-insights/quickstart`](https://vercel.com/docs/speed-insights/quickstart),
read 2026-09-21). Neither package is in `package.json` and neither component exists in
this tree. Adding one would be a new dependency, which under ADR-0003's rule needs an ADR
of its own, and this record refuses it in advance: plan §5's third non-negotiable is no
third-party analytics, and a product that reports page views of a screen showing a
clinician's name is exactly what that rule is about.

Worth stating so nobody relies on the wrong control: Web Analytics collects through
routes on the deployment's own origin, scoped at `/_vercel/insights/*`
([`/docs/analytics/quickstart`](https://vercel.com/docs/analytics/quickstart), read
2026-09-21). `connect-src 'self'` would therefore **not** block it. The absence of the
dependency is the control; the policy is not.

**The Toolbar is turned off per project, per environment.** Project settings carry a
Vercel Toolbar control with Default, On, and Off for Preview and Production
([`/docs/vercel-toolbar/managing-toolbar`](https://vercel.com/docs/vercel-toolbar/managing-toolbar),
read 2026-09-21); both are set to Off.

**Would the policy block it if the setting were wrong?** Tested, not reasoned. Vercel's
own documentation says a site with a Content Security Policy "may need to adjust the CSP
to enable access to the Vercel Toolbar", listing `script-src https://vercel.live` first
(same page). This repository's policy grants no such source, and
`tests/e2e/headers.spec.ts` now asserts the consequence in a real browser: a
`vercel.live` script tag placed into the served HTML is refused and the browser reports a
`script-src` violation naming it.

The test injects the tag into the markup rather than adding it with a script, and the
distinction is the point. `'strict-dynamic'` **deliberately allows** a script that already
passed the nonce check to load further scripts, so a toolbar injected by an already-trusted
script would run. What a platform does is write a tag into the HTML, which is
parser-inserted and needs a nonce of its own. That is the case the test covers and the
case the policy blocks. Stated plainly: the policy is a backstop against one shape of
injection, not a guarantee against every shape, and the setting is the control.

### 4. One function region: `iad1`

Vercel Functions "execute in *Washington, D.C., USA* (`iad1`) **for all new projects**",
the region is set in `vercel.json` under `regions`, and the number of regions a plan
allows is one on Hobby and five on Pro
([`/docs/functions/configuring-functions/region`](https://vercel.com/docs/functions/configuring-functions/region),
read 2026-09-21). The same page advises choosing regions close to the external services a
function calls.

`iad1`, in `vercel.json` in this repository, for three reasons. The function's only
external call is to the model API, which is reached over the public internet from the
United States. The representative and her events are in the United States, so the
round trip she waits on is shortest from the same continent. And it is the platform's
default for new projects, so choosing it is choosing not to introduce a variable: a
region set to something else would be a thing to remember when latency or an outage is
being diagnosed.

One region, not several. Multi-region buys availability this application does not need —
generation already fails softly, one recipient at a time — at the cost of more places a
request can be processed.

### 5. Never indexed, as a header and a file

`X-Robots-Tag: noindex, nofollow` on every response, set in `src/proxy.ts` beside the
other security headers and asserted against a live response in
`tests/e2e/headers.spec.ts`; and `public/robots.txt` disallowing everything, also
asserted there.

Both, not one. The header covers a URL a crawler reaches directly, including paths under
a deployment URL that no page links to; the file is what a crawler that asks first reads.
Neither is a control against a crawler that ignores them, which is what decision 2's
protection is for on preview and decision 6 is for on production.

This is in the public build too, deliberately. The public repository is meant to be read
on GitHub, and a second indexed copy of it serving from a domain is not useful to anyone.

### 6. The caller key, and the cost ceiling

**A per-device access key answers who may call the route.** There are no accounts by
design (`SECURITY.md`), and this does not add one: it adds a shared secret per device,
held as a hash on the server.

- The server holds SHA-256 hashes in `FIELDNOTE_ACCESS_KEY_HASHES`, never keys. The
  generation route hashes what the caller presents and compares in constant time
  (`src/lib/access/key.ts`), refusing with 401 before it reads the body. With the variable
  unset it refuses every request and says the variable is undefined. **It never falls back
  to open.**
- The key reaches the server in an `HttpOnly` cookie, set by `/api/access` from a plain
  HTML form on the settings screen. Cookie attributes: `HttpOnly; Secure; SameSite=Strict;
  Path=/api`, with a life of **90 days**. Long, because a key prompt in a car park is the
  kind of friction this project exists to remove, and because the cookie is not what
  protects a lost device — full-disk encryption and automatic lock are (ADR-0004;
  `docs/THREAT-MODEL.md` §5.6).
- **Nothing about the key is stored through the data layer.** No schema field, no
  migration, nothing in IndexedDB, nothing in `localStorage`, and nothing a script can
  read: `document.cookie` cannot see an `HttpOnly` cookie, and
  `tests/e2e/access-key.spec.ts` asserts that in a real browser.
- `scripts/generate-access-key.mjs` prints a key once and its hash, and writes neither to
  a file. A lost key is replaced, not recovered.
- A content-type check refuses a body that is not JSON with 415, before parsing.

**A form, not a header, and the reason is worth recording.** The obvious design puts the
key in an `Authorization` header in `src/lib/generation/client.ts`. That file is inside
`src/lib/generation/`, which `scripts/evals-watched-paths.mjs` watches, so the change
would make the adversarial suite call the live model to test a prompt and a ruleset that
nobody touched — real spend to prove nothing. The form has a second advantage that
outlasts that one: the key is never in a variable a script holds.

**No rate limit in code.** An in-memory counter on a serverless platform counts per
instance, so it bounds nothing; see *Alternatives*. The ceiling is a **monthly spend limit
on the model API key**, and it **is in place**: the owner set it on 2026-09-21, in the
provider's console, on a workspace dedicated to this deployment, so what this application
can spend is bounded separately from anything else the account does. That is an action
outside this repository and nothing here can verify it; it is recorded because a ceiling
nobody wrote down is a ceiling the next session assumes is missing.

### 7. What this record does not settle

- **Whether the service worker survives a Vercel build.** `pnpm build` writes
  `public/precache.json` after `next build` finishes, and whether the platform collects a
  file written into `public/` during the build command has never been checked because
  nothing has been deployed. If it is not collected, the worker's install throws and the
  installed app silently has no offline shell. `fieldnote-6x5`; session 21 verifies it
  against a real build, not by reasoning about the builder.
- **The representative's device settings.** Automatic screen lock is set on her device,
  by the owner, 2026-09-21. It remains a deployment precondition the application does not
  enforce and cannot detect (`docs/THREAT-MODEL.md` §5.6): what is settled is that it is
  on today, not that anything here would notice if it changed.
- **Which production URL she installs from.** Enabling Standard Protection restricts the
  production *generated* deployment URL
  ([`/docs/deployment-protection`](https://vercel.com/docs/deployment-protection), read
  2026-09-21), so the app must be installed from the project's production domain rather
  than from a generated URL. Session 21 confirms which URL that is on the real project.

## Alternatives considered

**Vercel Authentication for the representative, on production as well as preview.** The
simplest answer to "who may call the route": protect All Deployments and let the platform
do the authenticating. Rejected because it requires the representative to hold a Vercel
account with access to the project, on the phone, and to stay logged in to it — a second
credential and a second thing to lose, for a person whose whole interaction with this
system is meant to be opening an icon and typing. It also puts a platform login in front
of the offline shell, which is the feature the project exists for.

**Password Protection.** Vercel's own password gate, which needs no Vercel account for
the visitor. Rejected on cost and plan: it is "Not available" on Hobby and costs "$20 per
month per protected project" on Pro
([`/docs/deployment-protection/usage-and-pricing`](https://vercel.com/docs/deployment-protection/usage-and-pricing),
read 2026-09-21). That is $240 a year to put a shared password in front of a single-user
application, and it protects the whole deployment rather than the route that spends money.
The caller key costs nothing, is per device rather than shared, and is revoked by removing
one hash.

**An in-memory rate limit as the cost control.** A counter in the function, refusing more
than N requests a minute. Rejected because it is not a ceiling: Vercel runs functions in
as many instances as demand requires, so a per-instance counter multiplies by however many
instances exist, and the number is not knowable from inside one of them. A control that
looks like a spend limit and is not one is worse than none, which is the same reasoning
ADR-0004 used to refuse a key stored beside the ciphertext. A real limit would need shared
state — a store, a dependency, an ADR — to bound something the provider's own spend limit
already bounds exactly.

**No caller control, relying on the deployment URL being unguessable.** Rejected without
much deliberation, and recorded because it is the option that costs nothing and therefore
tempts. An unguessable URL is a secret that travels in every referrer, every log, every
screenshot, and every link the representative sends herself, and it cannot be revoked
without moving the application. It is also not what makes the route expensive to abuse:
the route holds an API key, and a URL nobody has guessed *yet* is not a control.

**Deploying the public build first, to exercise the path.** Tempting as a rehearsal, and
rejected because it is not the build anyone needs and it would put a second, indexable
copy of the repository on a domain. Session 21 exercises the path with the build that has
a user.

## Consequences

**Positive**

- The representative gets an origin that exists when the mini does not, which is the
  thing standing between this application and real use.
- The generation route stops being open. It refuses an unknown caller, an unconfigured
  server, and a body of the wrong type, each with a test, and it never degrades to open.
- The key is not in any script-readable store, so an injected script cannot read it out
  and a copied IndexedDB does not contain it.
- The three controls `fieldnote-9n1` asks for are answered: caller authentication in
  code, the content-type check in code, and the rate limit as a spend limit with the
  reasoning recorded rather than a counter that pretends.

**Negative**

- **Vercel becomes a party the request passes through**, and the place the function's
  logs live. Runtime log retention is "1 hour of logs" on Hobby and "1 day of logs" on Pro
  ([`/docs/plans/hobby`](https://vercel.com/docs/plans/hobby), read 2026-09-21). What is
  in those logs is what the route logs, which is metadata and never content — status, the
  model, stop reason, counts, durations — asserted by `tests/unit/generate-route.test.ts`
  ("logs metadata only: no note text, no draft text, no key"). The access route logs the
  same way and never the key or its hash.
- A monthly cost that did not exist before: the Pro plan, plus usage.
- One more thing the representative has to do once, on the device, and one more thing
  that can go wrong in a car park if the cookie is gone. Losing it costs her a key
  re-entry and nothing else: notes, drafts, and records are untouched.
- **Whether the cookie survives in the installed app on iOS is unverified.** A home-screen
  web app has its own storage, and this repository has never observed a cookie surviving
  in it across a relaunch or across the eviction window `fieldnote-bdw` describes. Session
  21's device check is where that is answered. If it does not survive, the failure is
  visible and cheap: drafting refuses, she opens the settings screen and enters the key
  again.
- A second same-origin request the page makes, which `tests/unit/single-egress.test.ts`
  does not see, because a form submission is not a `fetch` and a grep for call sites could
  not find one. What bounds it is `form-action 'self'` in the policy, asserted against a
  live response. `docs/THREAT-MODEL.md` §2 and §3.3 record it.

**Residual risk, stated plainly**

- **The key is a shared secret, and whoever holds it may call the route.** It is not tied
  to the device beyond living in that browser's cookie jar. A copied cookie is a working
  credential until the hash is removed.
- **The spend limit is set, and nothing in the repository verifies it.** The owner set it
  on 2026-09-21, on a workspace dedicated to this deployment. It is a setting in the
  provider's console, so this repository cannot read it, cannot test it, and would not
  notice if it were removed. The same standing gap as every other platform setting below.
- **Nothing in the repository verifies the platform settings.** Deployment protection,
  the toolbar switches, the environment scoping of both variables, and the region all live
  in Vercel's dashboard or in a file the platform reads at deploy time. `vercel.json`
  carries the region; the rest is a hand check each session, the same standing gap as the
  branch-protection settings in `docs/THREAT-MODEL.md` §5.2.
