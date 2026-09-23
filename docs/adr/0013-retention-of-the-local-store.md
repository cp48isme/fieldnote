# ADR-0013: Retention of the local store

- **Status:** Accepted
- **Date:** 2026-09-17
- **Deciders:** cp48isme (owner); the schema question and the mechanism by the session
  that implemented it, on the owner's decision

## Context

ADR-0004 declined to build encryption at rest and accepted the residual plainly: data on
the device is protected by full-disk encryption and the browser's origin isolation and by
nothing else. Part of what made that acceptable was stated in the same record — "a
retention policy that keeps the local store small. A device holding two events' worth of
notes is a smaller loss than one holding two years'."

No such policy existed. Nothing in `src/` deleted anything by age or on a schedule, and
the only thing that removed an event's content was the representative choosing to. So a
decision record was leaning on a property the application did not have, which
`fieldnote-tcq` recorded and plan §8 carried as an open question.

ADR-0008 sharpened it. Audit records survive the deletion of their event, by design,
because a cleanup action that erased the evidence of generation would turn cleanup into a
way to destroy the audit trail. That is right, and it means the store does not shrink to
nothing when events go: it keeps a hash-only record for every generation that ever ran.
Retention therefore had to be real behaviour rather than an assumption, and it had to say
what happens to the records.

The owner decided on 2026-09-16, then changed the decision on 2026-09-17. Both are in
`fieldnote-tcq`'s notes. This record carries the second and treats the first as
superseded, for the reasons under *Alternatives*.

## Decision

**An event's content is deleted thirty days after the event ends.** Six points, as the
owner set them on 2026-09-17.

1. **Scope: an event's content.** Attendees, notes, drafts, contacts, images, and the
   event itself — exactly what `deleteEvent` already cascades to, and nothing else.
2. **Automatic deletion at thirty days.** The clock keys on the event's `endsAt`; if that
   is null, `startsAt`; if both are null, the event's `updatedAt`. No ceiling beyond it
   and no export prompt.
3. **A notice from day twenty-three.** The application shows a notice on the event saying
   its content will be deleted and the date it will be. A notice, not a prompt.
4. **Her own delete is unchanged.** She can delete an event at any time, as before.
5. **Audit records are kept and never pruned**, per ADR-0008.
6. **The periods are build-time constants**, not a user setting. The private fork may
   carry different values.

### How it runs, and why not on a timer

The sweep runs **on load**, over every event past due, in `src/lib/db/retention.ts`. Not
on an interval: an installed web app is not running when it is closed, so a
`setInterval` would delete only while she happened to be looking at the screen, and a
rule that holds when observed is not a rule. Running it on load means the deletion
happens the first time the application opens after the date, which is the earliest moment
it exists to do anything.

Deletion reuses `deleteEvent`, so retention and a hand delete cannot drift apart: there is
one cascade, and the audit records are orphaned by the same code path in both cases.

One failure does not abandon the sweep. Each event is its own transaction already, and the
alternative — one throw stopping the rest — means a single bad record keeps every other
event past its date, which is the failure that actually matters here.

### Nothing is stored, and the schema stays at v9

Every date is computed from fields the event already has. No due timestamp, no warned-at,
no dismissed-at; no schema version and no migration. A stored due date would be a
denormalised copy that goes stale the moment she changes the event's end time, and
reconciling it would be more code than recomputing it.

**Two things that costs, taken deliberately rather than discovered later.**

- **There is no record that she saw the notice**, so it appears on every load through the
  whole seven-day window. For a notice that is right; for a prompt it would be wrong, and
  this is a notice. A dismissal that changed nothing would be a control that pretends.
- **After a deletion nothing distinguishes retention's work from hers.** The event is gone
  either way and its audit records are orphaned either way, so the store cannot say which
  removed it. Accepted: an audit record exists to prove a generation happened, not to
  explain why an event left, and adding a field to answer a question nobody has asked is
  the kind of schema change ADR-0004's classification work exists to avoid.

## Alternatives considered

**The 2026-09-16 decision: prompted, with a ceiling.** The owner's first decision, and the
one `fieldnote-iox`'s description still records. When an event became due the application
would ask her to delete it and offer the audit CSV and the briefing exports first; if she
did not act it would warn again seven days before a ceiling and delete at sixty days.

**Superseded by the owner on 2026-09-17, and the reasoning is the substance.** The
correspondence that matters has already left the device through her mail client, and that
copy is the record kept elsewhere; what the application holds is working material. An
export prompt therefore offers her a second copy of something she already has, at the
moment she is least likely to want a task. And a ceiling is a second deadline that exists
only because the first one was a request rather than a rule — remove the request and the
ceiling has nothing to be a backstop for. Thirty days, automatic, with notice, is the
whole policy.

**A timer while the application is open.** Rejected above: it would make deletion depend
on her having the app in front of her, which is precisely when she is working.

**Deleting audit records with their events.** Rejected in ADR-0008 and not reopened. It
would make the store shrink further and would let a cleanup action destroy the evidence
that generation ever happened.

**A stored due timestamp, written when the event's times are saved.** Rejected: the same
date is a pure function of three fields already on the record, and a copy that can
disagree with its source is worse than no copy. See *Nothing is stored* for what the
computed rule cannot do.

**Making the periods configurable.** Rejected as a user setting, per the decision. A
retention period that the person whose data it is can extend is not a retention policy.
The private fork changes the constants and rebuilds.

## Consequences

**Positive**

- ADR-0004's mitigation is now a property of the application rather than an assumption a
  record leans on. The store holds an event's content for thirty days after the event and
  not indefinitely.
- The rule is one module with the periods as named constants and the clock's fallback
  order in one function, so the rule and its tests agree by construction rather than by
  both repeating the same numbers.
- Nothing about this changes what she can delete by hand, or the shape of the cascade.

**Negative**

- **Audit records still grow without bound**, by decision, and this record does not change
  that. They are small — ids, hashes, timestamps, short strings — and after an event is
  deleted they are all that remains of it. ADR-0008 is the record; `docs/DATA-PROTECTION.md`
  §4 states it as an accepted consequence.
- Content leaves on a schedule whether or not she noticed the notice. That is what
  automatic means, and the notice is the mitigation rather than a confirmation step.
- The seven-day notice repeats on every load, for want of stored state.

**What this record does not settle**

- **The two deletion limits, both still open owner decisions.** Removing one attendee
  leaves their notes and drafts (`fieldnote-jqk`), and nothing deletes a single note or a
  single draft at all (`fieldnote-cdx`). Retention operates on whole events, so it neither
  fixes nor worsens either, and this session deliberately left the cascade's shape alone.
- **Nothing outside the application is reached.** A briefing PDF she downloaded, an audit
  CSV she exported, and an email she has already sent are all outside this rule and
  outside the store. `docs/DATA-PROTECTION.md` §3.4 records that once a file or a
  clipboard copy leaves, it is hers and the application cannot reach it; retention does
  not change that and should not be read as covering it.
- **When the deletion actually happens on a given device**, as distinct from when it is
  due. It happens on the first load after the date, so a phone left closed for a month
  deletes on the day it is next opened, not on the day the date passed.
