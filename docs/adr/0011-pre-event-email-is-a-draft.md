# ADR-0011: A pre-event email is a draft under the review gate, model or not

- **Status:** Accepted
- **Date:** 2026-09-15
- **Deciders:** cp48isme (owner)

## Context

Plan §3.3 scopes an email to registered attendees before an event: logistics, the
location with map links, a calendar attachment, and product information from the
approved content library. The plan never says the model writes it, and the guide's word
for session 12 is "template". It is composed from records: the representative's own
logistics text, the event's location, passages she selects from the library, and a
greeting from the attendee record, the way follow-ups already compose theirs.

Two things the plan left open. Whether a composed email is a draft — a `DraftRecord` in
the state machine, with an audit record and the clipboard export behind the review gate
— or a document like the briefing, which ADR-0009 gave neither because nothing was
generated. And whose text the ruleset judges: the model's only, or hers too.

## Decision

**A pre-event email is a draft.** One `DraftRecord` per recipient, marked
`kind: "pre-event"` beside the follow-ups' `kind: "follow-up"` (schema v7, backfilled).
The same state machine, the same detail view, the same export. An audit record is
written for each, with `model: null` and `promptTemplateVersion: null` because no model
and no prompt ran, the guardrail ruleset version that did run, the passages used, and
both hashes over the composed text below the greeting line.

The reasoning: the gate exists for what leaves the device, not for what the model did.
This is correspondence to a healthcare professional, it carries approved product
content, and it leaves by the clipboard into her mail client — exactly the path the
follow-ups take. ADR-0009 reasoned the other way for the briefing because the briefing
is internal, sent to her own team; this is not. Plan §4.3's words are "no generated
content can be sent without passing through review", and a composed email is generated
by this application even when no model was involved.

**The ruleset runs over the whole email, her text included.** Plan §4.2 is about what is
claim-bearing, not who wrote it. Her logistics paragraph goes through the same rules as
model output does; a comparison she types gets the gap marker, and she sees it in
review. The product section is not typed at all — it is passages selected from the
library, exact and exempt, as session 9's matcher makes them. ADR-0002's "unmatched
text is blocked, not flagged" is the rule for the whole body.

## Rejected

**Treat it as a document like the briefing.** No draft, no audit record, a download or a
copy. Rejected because it would let claim-bearing text reach a healthcare professional
without passing the gate: her own paragraph, unjudged, beside library passages the
matcher never checked. The briefing's exemption rests on its audience; this email's
audience is the one the whole control regime exists for.

**Judge only the model's text**, leaving hers alone as the briefing notes are. Rejected
for the same reason: the recipient does not know who typed which sentence, and the
regulator will not care.

## Consequences

- The audit record's `model` and `promptTemplateVersion` become nullable, with the reason
  in each field's policy. A null model on a record means "composed, nothing generated
  by a model"; the CSV writes an empty cell.
- The hashes on a pre-event record are over the composed body below the greeting line:
  her text and the library's, no recipient's name. If she typed a site contact's name
  into the logistics, it is in the pre-image. The record still holds no content, and the
  draft it points at holds the body already.
- The review surface, which had assumed every draft had a model behind it, labels the
  kind and explains a gap in words that do not name a model when there was none.
- The eval suite is unaffected: it measures the model's drafts, and a composed email
  never reaches the runner.
