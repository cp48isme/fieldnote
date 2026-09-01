# ADR-0004: Encryption seam in the data layer; passphrase-derived encryption deferred to the private fork

- **Status:** Accepted
- **Date:** 2026-09-01
- **Deciders:** cp48isme (owner)

## Context

Project plan §5 listed "WebCrypto envelope encryption at rest, key derived from a
passphrase" among the technical non-negotiables. It was written before the data layer
existed. Building it now, at the start of session 2, is the moment to establish whether
it earns its place — and what it actually defends against.

**In the public build it defends against nothing.** Per ADR-0001, all data in the public
build is synthetic: a fictional company, fictional attendees, fixture events. Encrypting
it would demonstrate the *shape* of a control rather than exercise one. A repository whose
argument is that governance controls should be load-bearing rather than decorative is the
wrong place to ship a control with no asset behind it.

**In the private build the picture is narrower than it first appears.** Enumerating the
threats to locally persisted data on the representative's device:

| Threat | Covered by app-level encryption? |
|---|---|
| Device lost or stolen while powered off | No — full-disk encryption already covers this |
| Device unlocked and unattended | No — the browser session is open; an attacker opens the tab |
| Malicious extension, or XSS in the page | No — operates in page context, after decryption |
| Backup or sync service copying the browser profile | Partially — only while the passphrase is not cached |
| Another local process reading the profile off disk | Yes, while locked — this is the genuine residual gap |

One row of five, and that row is conditional on the passphrase not being cached — which
in practice it would be, because a passphrase prompt on every load is not survivable at an
event.

Against that sits an availability cost that is not marginal. A passphrase-derived key with
no recovery path means a forgotten passphrase is permanent, unrecoverable loss of captured
data. The specific failure this project exists to fix is the prototype losing an
afternoon's notes when a tab closed. Introducing a *second*, worse way to lose an
afternoon's notes — one where the data is still on disk and simply unreachable — in
service of a control that closes one row of the table above is the wrong trade.

The cost of *not* deciding now is real, though: retrofitting encryption onto populated
Dexie stores means a migration, a re-key path, and a mixed-state period where some records
are encrypted and some are not. That is a genuinely unpleasant piece of work and a
plausible source of data loss in its own right.

## Decision

**Build the seam in session 2. Defer the cryptography to the private fork, as session 19.**

Session 2 establishes:

- All persistence routes through a single data-access layer. No feature code calls Dexie
  directly. This is the only rule that must hold; everything else below is cheap once it
  does.
- `encrypt` and `decrypt` hooks in that layer, implemented as identity pass-throughs.
- Every field in the schema marked encryption-eligible or not, so the classification
  decision is made once, at schema-definition time, with the field in front of you —
  rather than reconstructed later from memory.
- The schema version already in place per plan §5, so an encryption migration has a
  version to move from.

Session 19 implements real WebCrypto envelope encryption over that seam, in the private
fork only, and does not ship until it has a stated key-recovery story. Swapping a hook
implementation is not a migration over populated stores.

Session 19 is deliberately numbered at the end rather than inserted into phase 2.
Renumbering sessions 9–18 would invalidate every cross-reference in the plan, the build
guide, and the handoff, which is a larger cost than the ordering benefit. It is not on the
public build's critical path.

## Alternatives considered

**Ship passphrase-derived encryption now, in both builds.** The original plan.

Rejected on the availability argument above. It also encrypts synthetic data in the public
build, which is demonstration rather than control, and the demonstration is weaker than
this ADR is.

**Drop encryption from the non-negotiables entirely.** Rely on full-disk encryption and
the local-first posture, and say so.

Rejected. The residual gap in the table above is real, and the seam costs almost nothing
to establish while the schema is being written. Removing the requirement outright would
also mean the field-level classification never gets made, and that judgement is easier now
than later.

**Encrypt with a key held in IndexedDB or localStorage**, avoiding the passphrase prompt.

Rejected, and worth naming explicitly because it is the compromise that suggests itself.
A key stored beside the ciphertext, readable by anything that can read the ciphertext,
defends against nothing. It would satisfy a checklist item and appear in a compliance map
as an implemented control. In a repository arguing that controls should be tested rather
than asserted, shipping a control that is inert by construction is worse than shipping
none, because it is a claim that does not survive inspection.

## Consequences

**Positive**

- No availability risk introduced into the capture path, which is the system's primary
  requirement.
- The expensive part of retrofitting — routing all persistence through one layer and
  classifying every field — happens at schema-definition time, when it is nearly free.
- Session 2 is not delayed by a cryptographic design decision that the private fork's
  key-recovery story has to settle first.
- The reasoning is a portfolio artifact in its own right. A documented, threat-modelled
  decision *not* to build a control reads as stronger judgement than the control would
  have.

**Negative**

- Plan §5's non-negotiable list is weaker as stated than as originally written, and a
  reader who sees the list before this ADR may read it as a gap. §5 must point here.
- Session 19 may not ship. If the private fork goes into use before it does, the residual
  gap stays open — which is acceptable, but should be acknowledged rather than forgotten.
- The pass-through hooks are dead code until session 19, and dead code rots. They need a
  unit test asserting round-trip fidelity so the seam is exercised rather than merely
  present.

**Residual risk — not mitigated by this decision**

Data at rest in the private fork is protected by full-disk encryption and the browser's
origin isolation, and by nothing else. A local process running with the user's privileges
can read the IndexedDB store. This is the accepted position, not an oversight, and it
should be stated in `docs/THREAT-MODEL.md` (session 15) and `docs/DATA-PROTECTION.md`
(session 16) in those terms rather than elided.

The mitigations that actually bound this are architectural and already decided: no
server-side store of HCP data (plan §5), pseudonymization before the only egress boundary
(§4.1), and a retention policy that keeps the local store small. A device holding two
events' worth of notes is a smaller loss than one holding two years'.
