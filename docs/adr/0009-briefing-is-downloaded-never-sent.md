# ADR-0009: The briefing is a document the representative writes and downloads; the application lays it out and never sends it

- **Status:** Accepted
- **Date:** 2026-09-14
- **Deciders:** cp48isme (owner)

## Context

Plan §3.2 scopes an internal briefing PDF built before an event. `fieldnote-g7d` records
the owner's decision that its distribution path needs an ADR before anything is built,
because the document carries the most identifying material in the system into a channel
the application does not control.

## Decision

Three things, each the simplest available.

**The application never sends it.** The briefing is generated on the device and offered
as a download. The representative saves the file and sends it through her own mail
client, exactly as she pastes an exported follow-up. No mail capability, no share
target, no upload.

**The model does not write any of it.** The briefing is laid out from what the
representative enters — event details, logistics, contacts, and for each attendee the
stored record, an uploaded photo, and whatever she types or dictates about them. Plan
§3.2's "suggested opener" and "selected talking points" are withdrawn: she writes the
opener, she writes the talking points. No generation, no prompt, no ruleset, no audit
record, because nothing was generated.

**Deal positioning is not in the public build.** Not as a field, not as a section. The
private fork may add it under ADR-0001; the public build has no home for it.

## What this settles

The single-egress claim survives as written: a file the browser writes to the device is
not a network destination, and what the representative does with it afterwards is her
action in her mail client. The review gate does not apply, because there is nothing
machine-written to review — the document is hers throughout. The document states on
its page that its attendee section is expected attendance as of the generation date
(`fieldnote-g7d`). Once downloaded the file is outside the system, and the DPIA
(session 16) accounts for that rather than this ADR pretending otherwise.

## Rejected

A share sheet or mailto: link — a new capability handed to another application from
inside this one, for one step of convenience. Server-side generation — there is no
server-side data by design. Model-written openers or talking points — the original plan,
withdrawn: they would have made the briefing a generation path needing pseudonymization,
guardrails, and audit for a document whose author is in the room and can write two
sentences herself.

## Consequences

Plan §3.2 is amended: talking points and openers are entered, not selected or suggested.
Guide session 10 loses "suggested openers" outright, not deferred. Guide session 11
gains the form the representative fills. Photo storage — a binary entity, the cipher
extended for it — is a schema decision for the session that builds it, and now has its
distribution rule. `fieldnote-g7d`'s ADR requirement is met; its schema and entity gaps
remain and go to session 11.
