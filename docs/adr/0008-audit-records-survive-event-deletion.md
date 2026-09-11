# ADR-0008: Audit records survive event deletion

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** cp48isme (owner); the shape of what a record must therefore carry, and
  what is hashed, by the session that implemented it
- **Amended:** 2026-09-11, later the same day — the greeting line is now composed on the
  device from the attendee record (`greeting.ts`, prompt template 1.1.0, `fieldnote-viw`)
  and sits at the head of `generatedBody`. It is outside `outputHash` on purpose: the
  hash is of what the model produced. The sentence under *What is hashed* about
  re-pseudonymizing `generatedBody` to reproduce the output pre-image therefore applies
  to the body below the greeting line. The decision is unchanged.

## Context

Plan §4.4 calls the audit record immutable: every generation writes one, with the model
and versions, the hashes, the flags, and — once a human has acted — whether they edited
and by how much. Plan §4.3 makes export impossible until a human has opened the draft.
Together they are the human-in-the-loop control the repository exists to demonstrate,
and a control is only as good as the evidence that it ran.

Session 2 built the data layer and made one decision it could not defer: what
`deleteEvent` cascades to. Attendees, notes, and drafts are meaningless without their
event and go with it. Audit records were deliberately spared, and the reasoning was
written in a source comment and the body of PR #12: if deleting an event erased them,
deleting an event would erase the evidence that generation ever happened, and a cleanup
action would become a way to destroy the audit trail. `fieldnote-x9p` recorded that this
was a governance choice living in a comment and belonged in an ADR.

Session 6 writes the first audit records, so it writes the record. Two things have
changed since session 2 that the decision now has to account for. **Blocked drafts
persist.** A refusal, a truncation, a hallucinated name withheld by the output guard — the
pipeline's most audit-worthy outcomes — are written as drafts with a reason and no body,
so that their records have something to point at and "every generation writes a record"
is true for exactly the generations that matter. **The record is exported.** Plan §4.4's
CSV for an auditor now exists, and it reads every record on the device.

## Decision

**Deleting an event deletes its attendees, its notes, and its drafts, inside one
transaction, and does not touch its audit records.** `deleteEvent` in
`src/lib/db/repository.ts` is the only cascade, and `tests/unit/repository-drafts.test.ts`
demonstrates it: the counterfactual that adds the audit table to the cascade fails the
suite.

**Audit records are orphaned by design, and every reader tolerates it.** An
`AuditRecordRecord.eventId` may point at an event that no longer exists. Nothing
filters those records out; nothing joins through the event to read them. The CSV export
lists them beside live ones with an `eventStatus` column — `present` or `deleted` — so
that an auditor reading a row whose event id resolves to nothing reads the column rather
than suspecting the file.

**A record carries everything an auditor needs, because after deletion it is all that
remains.** That is the consequence that shapes the schema. Beyond what plan §4.4 lists,
the record holds the blocked reason (copied from the draft, so a withheld generation is
legible without its draft), the reviewed and exported timestamps (so "when" is on the
record, not inferred from `updatedAt`), and `humanEdited` and `editDistance` as null
until export rather than a false that reads as "not edited" when the truth is "never
exported". Nothing on it is content, and nothing is encryption-eligible, for the reason
the schema states: an audit log an auditor cannot read without the data-owner's
passphrase is a worse audit log.

**Immutable, in this sense.** A record is written once, with its draft, in the same
transaction. It is never deleted. It is touched exactly twice afterwards, by the two
review-gate transitions, each of which fills fields that are null until then and refuses
to fill them again; the generation facts never change. `createDraftWithAudit` is the only
write path for a new draft, and there is no `createDraft`.

**A blocked draft's record survives too**, and is the case where survival matters most:
it is the evidence that the pipeline refused, or the model did, or the guard withheld. It
carries the input hash and, where the model produced text that was then withheld, the
output hash, so the record says what was withheld.

### What is hashed

The record's two hashes are what it holds instead of content, and the choice of pre-image
is part of this decision because it determines what an orphaned record can still be
checked against.

- **`inputHash`** is SHA-256 of the request body exactly as the client serialises it —
  the pseudonymized notes, the recipient token, the prior openings, the event name. It
  reconstructs against material that names nobody, which is the point: an audit record
  whose hash only reconstructs against text containing real names is a worse record. It
  is null for `defect`, where no request was built and nothing crossed.
- **`outputHash`** is SHA-256 of the model's text after the guardrails and before
  rehydration: what the ruleset let through, still name-free. It is null where the model
  produced no text.

Neither pre-image is stored. The rehydrated `generatedBody` on the draft is what a human
reads; re-pseudonymizing it on the device reproduces the output pre-image for an
unblocked draft, because rehydration writes canonical forms and the tokenizer is stable
on them. The hashes are computed in the pipeline, the only place the pre-images exist,
and the function is `src/lib/generation/hash.ts`.

## Alternatives considered

**Cascade to audit records, and treat the CSV as the durable copy.** Simplest, and the
first thing a reader expects a delete to do. Rejected because it makes the audit trail's
survival depend on someone having exported it first, which is a procedure rather than a
control. The record's survival has to be a property of the store.

**Soft-delete the event and keep everything.** Keeps the join intact. Rejected because
the retention consequence ADR-0004 names — the local store does not shrink when events
are deleted — would then apply to notes and attendee records, the most sensitive data on
the device, rather than to hash-only records. Orphaned records cost bytes; retained notes
cost the thing the store is meant to minimise.

**Discard blocked drafts and write a record with no draft to point at.** Rejected because
`draftId` would then be a dangling reference on the records that matter most, and
because a withheld draft's explanation belongs where the representative reads it.

**Hash the rehydrated text.** Would let an auditor holding the draft verify the hash
directly. Rejected for the reason stated above: the pre-image would then contain names,
and the record would verify only against the data it exists to hold no copy of.

**Store the pre-images on the record.** Rejected without extended analysis: plan §4.4
says hashes, never content, and the private fork's threat model rests on it.

## Consequences

**Positive**

- A user cannot truncate their own audit trail by deleting an event, and the suite fails
  if that changes.
- Every generation, including every withheld one, leaves a record that is legible on its
  own.
- The CSV is honest about orphans in-band, per row, with no header a parser would choke on.

**Negative**

- The store grows monotonically in audit records. They are small — ids, hashes,
  timestamps, a handful of short strings — but the retention policy session 16's
  data-protection assessment owes must say what happens to them, and this ADR does not
  decide it. ADR-0004's retention note now has a second entry on it.
- `humanEdited` and `editDistance` changing from a value to null-until-export is a
  meaning change on two existing fields, carried by migration v2. No v1 build ever wrote
  either, so nothing was reinterpreted.

**Residual risk, stated plainly**

- An orphaned record proves a generation happened and what its inputs and output hashed
  to. It cannot reproduce them, and after the draft is gone nothing on the device can.
  That is the design, not a gap: the alternative is holding content in the log.
- Immutability is enforced in the data-access layer, not by the store. A process with
  the user's privileges can open IndexedDB and rewrite anything, which is ADR-0004's
  accepted position for the whole store and is not made worse here.
