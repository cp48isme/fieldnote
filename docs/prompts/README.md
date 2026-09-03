# Session prompts

The prompt each session was given, and — for sessions that have run — a short note on how
it actually went.

## Why these are kept

The handoff records the state of the repository. The beads record findings and open
questions. Neither records **what was asked for**, and the difference between what was asked
and what was built is often the most useful thing about a session.

Three of the four sessions so far contained a premise that turned out to be false:

- **Session 3** was told to port an already-validated prototype. It did not exist in the
  repository and was not retrieved, so the capture surface was built from a four-sentence
  feature list instead. The guide and the plan were amended, and `fieldnote-xjs` tracks that
  the layout is therefore unvalidated. Without this record, a later reader sees a capture
  surface and no reason to doubt it.
- **Session 3** was also told, via plan §5, that shadcn/ui belonged to it. It was deferred
  to session 8, the first session that needs its primitives.
- **Session 5's** prompt contained two conflicts between `CLAUDE.md` and the build guide
  that neither document resolved on its own — the eval ordering and claim-bearing text with
  no library to select from. Both were decided before the session started, and the decisions
  are in the prompt.

A prompt is a plan written before contact with the repository. Keeping it beside the outcome
is how the difference stays visible.

## Convention

- One file per session, `session-N.md`.
- The prompt verbatim, under a rule, so it can be pasted into a fresh session unchanged.
- Anything sent mid-session that changed the work goes in an **additions sent mid-session**
  section, because it is part of the instruction set rather than the transcript.
- Once the session has run, a short **how it actually went** section: chiefly where a
  premise turned out to be false, and what was decided rather than read.

Prompts are written by Guardian — a separate Claude instance that reviews the work and
drafts the prompts, running with no shared context and no direct view of the repository.
That is why premises drift, and why every prompt opens with a verification pass rather than
with the work.
