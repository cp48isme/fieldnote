# ADR-0002: Attendee invitation limited to recipient-forwarded messages

- **Status:** Accepted
- **Date:** 2026-08-27
- **Deciders:** cp48isme (owner)

## Context

Registered attendees at a demonstration event frequently know colleagues who would
find the event worthwhile. Capturing that is genuine value: the strongest attendance
driver at these events is peer recommendation, and the representative currently has no
mechanism for it beyond hoping someone mentions it.

The obvious implementation — let the attendee supply a colleague's contact details and
have the system reach out — is the one that should not be built. The system operates
in a domain where communications from a manufacturer's representative to a healthcare
professional are subject to promotional review obligations, and where anything
resembling an inducement attached to a physician referral carries serious consequences
under anti-kickback and transparency regimes.

The design question is therefore not "how do we implement referrals" but "how much of
the value can be captured without the manufacturer initiating contact with anyone who
did not ask for it."

## Decision

**Design A: recipient-forwarded invitation. Disabled by default, enabled per event by
the representative.**

When enabled, the pre-event communication to a registered attendee includes a
self-contained, forwardable block: event logistics, location, timing, and product
information drawn exclusively from the approved content library (see project plan
§4.2). The attendee forwards or texts it themselves, through their own mail or
messaging client.

The system does not send it. The manufacturer does not learn who received it.

Any resulting interest arrives through the representative's existing intake path,
which is already an approved process. From that point the new attendee is handled
identically to any other registrant.

Constraints, all enforced in code rather than by policy:

- No tracking pixels, link decoration, unique URLs, or referral attribution of any kind.
- No incentive, reward, gift, or recognition attached to forwarding.
- No collection of the forwarded-to party's details at any point.
- Forwardable content is claim-bearing and therefore restricted to approved library
  content; unmatched text is blocked, not flagged.
- The feature ships disabled; enabling it is a per-event action.

## Alternatives considered

**Design B: representative-sent invitation on referral.** The attendee supplies a
colleague's name and address; the system drafts and the representative sends.

Rejected. This is a manufacturer's representative initiating promotional contact with
a physician who has not opted in. It creates a targeting record of physicians who were
identified by a peer rather than by their own expressed interest, adds electronic
communication consent questions on top of the promotional review question, and moves
the system from "drafts the user's own correspondence" to "generates outbound
prospecting," which is a materially different control regime.

The incremental value over Design A does not approach the incremental risk. The reason
a physician brings a colleague is that they want to; a well-written forwardable message
captures nearly all of that.

**Design C: automated referral chain.** Recipients can invite further recipients
without the representative in the loop.

Rejected without extended analysis. Uncontrolled propagation of claim-bearing material
to unknown healthcare professionals, with no human review at any hop, is not a defensible
design in this domain at any risk appetite.

## Consequences

**Positive**

- No outbound contact is ever initiated to a person who has not asked for it.
- Nothing leaves the system without passing the approved-content gate and human review.
- No new personal data is collected about non-attendees.
- The absence of tracking is itself a design statement, and a defensible one.

**Negative**

- Forwarding is unmeasurable by construction. There will be no attribution data, and
  no way to demonstrate the feature's effectiveness quantitatively.
- Some attendance that Design B would have captured will not be captured.

The loss of measurement is accepted deliberately. Instrumenting forwarding would
require exactly the tracking this decision rejects, and the resulting record — which
physician recommended which physician — is a dataset with more downside than analytic
value.
