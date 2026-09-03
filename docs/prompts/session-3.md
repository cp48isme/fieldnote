# Session 3 kickoff prompt — capture UI and offline shell

Session 3 — capture UI and offline shell. Work from docs/BUILD-GUIDE.md session 3;
read it in full before writing anything. This prompt is a summary and the guide is
the source of truth.

Read first, in full: docs/HANDOFF.md, docs/BUILD-GUIDE.md session 3 (line 71),
CLAUDE.md, and docs/adr/0005-dictation-input.md. Also docs/PROJECT-PLAN.md §3.1
(line 98) for the capture surface and §5 non-negotiable 5 (line 316) for the PWA
requirement.

If anything here conflicts with CLAUDE.md, stop and tell me. Do not resolve it.

Branch: feat/session-3-capture-ui

## Scope

Port the prototype's capture dock and log onto the session 2 data layer. The design
is already validated — rebuild it with proper components and types, don't redesign
it. All persistence through src/lib/db; no module outside that directory imports
Dexie, and tests/unit/db-boundary.test.ts fails the build if one does.

Plus the service worker and PWA manifest, about an hour of the four.

Per ADR-0005 the app records no audio and knows nothing about dictation, but the
textarea has to be comfortable to correct text in one-handed, standing up.

## Scope guard

Do NOT build the pseudonymization boundary or anything that sends content to a
model. That is session 4 and session 5, and session 4 must land before generation
exists — the build guide is explicit that a retrofitted boundary leaks. Capture
writes notes. It does not tokenize names and does not call an API.

## Also in scope

fieldnote-5pr: resumeSession is untested. The tab-hidden-then-visible path is wired
and typechecked but has no test, and this session's offline work exercises the same
visibility lifecycle. Cover it here. This connection lives only in a bead, not in
the build guide.

## Done when

Capture works after a hard reload with the network disabled — not merely with the
network toggled off on an already-loaded page, which passes without a service
worker and proves nothing. Verify it the hard way and show me.

## Constraints

- Synthetic data only. Any fixture or test name invented, per ADR-0001.
- TypeScript strict, no `any` without an adjacent comment.
- Prefer the plainly correct implementation. If a task tempts you toward a
  shortcut, say so rather than taking it.
- If you need a dependency not already in package.json, stop and ask.
- Never --no-verify. Stop and show me if the hook fires.
- `gh pr create`, NOT --fill.
- Separate commits per logical change.
- Last commit regenerates docs/HANDOFF.md from docs/HANDOFF-TEMPLATE.md, re-reading
  the sources rather than editing the existing handoff.
- Stop at the end of this session. Do not start session 4.

## Report back

What you verified versus assumed, flags last. Include anything you had to decide
rather than read from the guide.

---

## How it actually went, for whoever reuses this

Two premises in this prompt turned out to be false, and both were worth the stop:

- **"Port the prototype... the design is already validated."** The prototype was a
  Claude artifact built outside the repository and was not retrieved. The capture
  surface was built from plan §3.1 instead, and the build guide and §3.1 were both
  amended to say so. Tracked as `fieldnote-xjs` — the layout is unvalidated.
- **"If you need a dependency not already in package.json, stop and ask."** Plan §5
  attached shadcn/ui to this session; it was deferred to session 8, the first
  session needing its primitives, and §5 was amended.

Six of the session's thirteen commits were review findings fixed in place, not
planned work.
