# Session 23 — The device findings

**Process note.** Guardian wrote this prompt — the separate Claude instance that reviews
the work and drafts the prompts, with no shared context and no direct view of the
repository.

**On what is missing from this file.** The private repository's name, the Vercel
project, and every deployment URL or domain appear nowhere here, in the commits, or in
any bead, as in session 21. Where the prompt referred to one it is written as
`<private>` or "the production domain".

---

Session 23 — the device findings. Public repository cp48isme/fieldnote, then a sync of
the private repository. Stops means stops.

## Ground rules
Every earlier rule stands: the private-material sentence; no approval language; no
person named ("the representative"); the private repository's name, the Vercel project,
and every deployment URL or domain appear nowhere in the public repository, its commits,
PRs, or beads; you never see a secret.

## Part 0 — Verify
main at 6c9a3cd or a descendant; tree clean; the local-only bead checks before the first
bead command and after the last; `lsof -iTCP:3000` clear before any e2e run.
Read: fieldnote-cno; src/components/capture/CaptureScreen.tsx; src/app/settings/page.tsx;
src/app/api/access/route.ts; src/app/api/generate/route.ts; the app's global styles and
every place that sets a colour scheme or dark-mode variant; the web app manifest and any
theme-color meta; ADR-0012 in full; tests/unit/access-route.test.ts;
tests/e2e/access-key.spec.ts.
Before writing code: run the watched-path check against every file you expect to change,
and report it. If anything is watched, stop.

Branch feat/session-23-device-findings.

## Part A — fieldnote-cno, item 1: settings reachable on a fresh install
The Device link must render whether or not an event exists. Find where the header is
gated on an event and make the link independent of that gate, without changing what
else the header shows. Test, e2e: a fresh browser context with empty storage shows the
Device link on first load, before any event is created, and it opens the settings screen.

## Part B — fieldnote-cno, item 2: a saved key confirms itself
The screen cannot read the cookie (Path=/api, by design), so confirmation comes from the
redirect:
- On a match, /api/access redirects 303 to /settings?saved=1, and the settings screen
  shows: "This device is remembered. You can close this screen." with a link back to the
  app. On "forget", redirect to /settings?forgotten=1 with "This device has been
  forgotten." The failure case is unchanged.
- The screen also says, always, in small text: "This screen can't check later whether a
  key is saved. If drafting says the device isn't authorised, enter the key again."
- The cookie's attributes and the route's decisions do not change.
Update tests/unit/access-route.test.ts and tests/e2e/access-key.spec.ts for the new
redirect targets and messages. If ADR-0012 states the redirect target anywhere, add a
dated amendment; if not, none.

## Part C — Always cream
The app uses a cream background regardless of the device's dark-mode setting. Remove the
dark variant rather than overriding it: one light palette. Background a warm cream
(propose a value, around #FAF6EE); text, borders, buttons, the draft states, and the gap
marker all re-checked against it. Every text/background pair must meet WCAG AA (4.5:1
body, 3:1 large text and UI boundaries): compute and list each ratio in the report. The
manifest's background_color and theme_color, and any theme-color meta, set to match,
and `color-scheme: light` declared so form controls do not render dark.
Test, e2e: with the browser emulating prefers-color-scheme: dark, the computed body
background is the cream value and the capture screen's text colour is the light
palette's.
Do not change the home-screen icon.

## Part D — The model key announces itself at start-up
The generation route's start-up line gains one field, modelKey: "present" or "absent",
from whether ANTHROPIC_API_KEY is non-empty. Never the value, never a length or a
prefix. Test: present, absent, and empty-string (absent), and the line never contains
the value. ADR-0012: a dated amendment saying the start-up line now reports both
variables the route refuses without, and why: on 2026-09-22 a missing model key was
found only by drafting on the device.

## Part E — Record, PR, merge
- Guide: a session 23 entry after 22, amended on completion. Do not renumber.
- Handoff regenerated from the template. Correct one statement from session 21's: the
  spend limit was set on 2026-09-21 and was not replaced; on 2026-09-22 the model key
  was replaced within the same capped workspace. Add, under how to work: every change
  that should reach the representative needs the private repository synced (Part F),
  and each sync is a production deploy.
- Changelog line; docs/prompts/session-23.md with this prompt, the process note that
  Guardian wrote it, and how it went.
- Close fieldnote-cno with the tests named. Bead checks around every write.
- Leak grep for the private repository's name, the production domain, and any
  vercel.app host: zero hits or stop.
- Watched-path check against the diff (none), unit and e2e green, push, gh pr create
  (never --fill), four checks with the eval gate skipping, merge with a merge commit.

## Part F — Sync the private repository (this deploys production)
In the private clone (~/dev/<private>), not the public one:
- `git fetch upstream`; confirm the private main is an ancestor of upstream/main;
  `git merge --ff-only upstream/main`; `git push origin main`. If fast-forward is not
  possible, stop: the private repository must never diverge.
- Report both HEADs, equal, with the private name redacted.
- Wait about three minutes for Vercel to build, then against the production domain:
  GET /settings shows the always-present guidance text; GET / serves HTML containing
  the Device link on a fresh load (curl, no cookies); the security headers and
  x-robots-tag are unchanged; POST /api/generate with no cookie still returns 401
  "This device is not authorised."
- OWNER: open Vercel Logs, search privateTerms, and report the newest start-up line's
  privateTerms, count, source, and modelKey. Stop until reported. modelKey must be
  "present".

## Part G — OWNER, on the representative's phone
Print these steps and stop for the results:
1. Open Fieldnote from the icon. If it shows the old dark screen, kill it and reopen:
   the service worker may serve the previous version once while the new one installs.
2. The background is cream; text is easy to read, including outdoors if possible.
3. Tap Device (it should now be visible on the home screen). The guidance line is there.
4. Enter the key again and tap Remember this device: the "This device is remembered"
   message appears.
5. Create a test event, draft once, confirm a draft; delete the event.
Report each as yes/no with anything odd.

## Scope guard
No retention code (session 22). No change under a watched path. No new dependency. No
change to the cookie, the access decision, the pseudonymizer, the ruleset, or the
prompt template.

## Report back, raw output
1. The watched-path check before code and against the final diff.
2. The diffs for every changed source file in full; the palette with every contrast
   ratio.
3. Test names added, unit and e2e counts.
4. The PR, the four checks and the skip line, the merge commit.
5. Part F: both HEADs, the deployment checks, the owner's log line.
6. Part G's results as reported.
7. The bead checks; bd show fieldnote-cno after.
8. Anything that met a stop condition.

---

## How it actually went, for whoever reuses this

**Nothing met a stop condition.** The watched-path check was run against the expected
file list before any code and against the final diff afterwards; twenty-six files were
touched and none is watched.

**Part C was the part where reasoning would have been wrong.** The palette maths said
the foreground and the muted greys were fine, and they were. What the maths would not
have caught is that Tailwind v4 states its colours in `oklch`, so a quick conversion by
hand is a guess. Every pair was therefore measured in a real browser, by painting the
computed colour onto a canvas over the cream and reading the sRGB bytes back. Three
pairs failed and would have shipped otherwise: the error red at 4.43:1 against a 4.5
requirement, and two notice borders at 2.51:1 and 1.43:1 against 3:1. All three moved to
darker shades of the same hue.

The other thing the measurement settled is the one that was never in question because
nobody had asked it: the old control boundary, black at ten percent, is 1.26:1 on cream
and was presumably no better on white. It is a token now, at 3.32:1. For an application
used outdoors that is the change most likely to matter, and it came out of a requirement
about dark mode.

**`opacity-40` is the one pair below threshold that stayed.** All eighteen uses are
`disabled:opacity-40`, and WCAG 1.4.3 exempts inactive components explicitly. Recorded
here rather than quietly passed over.

**Part B changed a fact in ADR-0012**, which is why there is a second amendment: decision
6 named the redirect target, and every outcome now lands on the settings screen instead.
The cookie's attributes and the route's decisions did not change, and the tests that
assert them did not need touching beyond the two redirect strings.

**Part D is a report, not a control.** The start-up line now says whether the model key
is present. Nothing fails if it says absent — no test can, because the variable is only
absent on a deployment — so what this buys is that the next occurrence is visible in a
log rather than discovered by someone drafting in a car park. Worth being plain about,
because a line in a log reads like a check and is not one.
