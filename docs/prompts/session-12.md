# Session 12 — Email composer and logistics

Written from a read-only printout of the repository taken 2026-09-15; checked again at the
start of the session, on `main` at `977a3ff` after PR #45. No premise was wrong. What was
decided rather than read is in the how-it-went section at the end.

---

Session 12 — the pre-event email, the location, and the site map. On `main` at
`977a3ff`. One PR. Phase 3 starts with an empty tracker; findings get beads as usual.

Read before starting: `CLAUDE.md`; `docs/HANDOFF.md`; plan §3.3, §4.2, §4.3, §4.4;
ADR-0002, ADR-0008, ADR-0009; `src/lib/db/` in full; `src/lib/generation/pipeline.ts`,
`greeting.ts`, and the passage matcher from session 9; `src/lib/images/resize.ts`;
the review components; `tests/unit/single-egress.test.ts`.

## The two decisions the plan left open

**A pre-event email is a draft under the review gate, model or not.** It is
correspondence to an HCP that leaves the device by the clipboard, and it carries
approved content. The gate exists for what leaves, not for what the model did. ADR-0009
reasoned the other way for the briefing because the briefing is internal; this is not.
So: one `DraftRecord` per recipient, `kind: "follow-up" | "pre-event"` (schema v7,
backfill `follow-up`), the same state machine, the same detail view, the same export.
An audit record is written with `model: null`, the ruleset version, the passages used,
and both hashes over the composed text; `promptTemplateVersion` is null because no prompt
ran. Write this as ADR-0011, short, with the reasoning above and the alternative
rejected: treating it as a document like the briefing, which would let claim-bearing
text reach an HCP without passing the gate.

**The ruleset runs over the whole email, hers included.** Plan §4.2 is about what is
claim-bearing, not who wrote it. Her logistics paragraph goes through `applyGuardrails`
like model output does; a comparison she types gets the gap marker and she sees it in
review. The product section is not typed at all — it is passages selected from the
library, exact and exempt like session 9's. ADR-0002's "unmatched text is blocked, not
flagged" is the rule for the whole body.

## Schema v7

- `DraftRecord.kind`, above.
- `EventRecord` gains `address` and `coordinates`, both eligible strings.
  `coordinates` is one string, "lat, lng", validated on entry to two decimal numbers in
  range — one field, not two numbers, so the cipher keeps two shapes. Plan §3.3:
  coordinates matter more than the address; a truck in a parking lot is not at the
  building's street address, and the screen's copy says so.
- `AuditRecordRecord.model` and `promptTemplateVersion` become nullable, with the reason
  in the policy `why`.
- Migration, backfills, a migration test against the fake database.

## The composer

Reached from the switcher. One screen:

1. **Location** — address, coordinates, and a site map. The map links are built from
   the coordinates: Apple Maps and Google Maps universal links, shown as the text they
   will be in the email. They are strings in an email, never fetched, and the
   single-egress test stays green; say so where they are built.
2. **Logistics** — the event's existing `logistics` field, edited here: arrival
   window, time commitment, what to wear, what to expect. Free text, guarded.
3. **Product information** — the library's passages as a checklist; selected ones go in
   verbatim. Empty library, empty section, and the email says nothing about the product.
4. **Recipients** — the event's attendees, all selected by default; the walk-in and
   expected-attendance caveat does not apply here because this is before the event.
5. **Compose** — one draft per recipient: greeting composed from the record as
   follow-ups are; her logistics text; the location block; the product passages; a
   sign-off. Through `applyGuardrails` with the library so passages are exempt and
   everything else is judged. Drafts land in the review surface with a "pre-event"
   label beside the follow-ups; export is the existing detail view.

No forwardable block. That is session 14 and it is behind a flag; leave the composer
a place for it and nothing more.

## The site map

Owned by the event in `images` with `purpose: "site-map"`. Two changes to the resize:
a media-type parameter, and the longest edge as a parameter — 1600 pixels and PNG for
maps, because a map with "north lot behind Building C" on it is unreadable at 512 and
JPEG smears the text. Photos keep 512 and JPEG. Tests for both settings.

A site map cannot ride the clipboard. Decision: **it downloads as a file** from the
composer through the download helper, and the composed email says "site map attached"
only when one is stored, so she attaches it in Mail beside the `.ics` session 13 will
produce. And **the briefing draws it**: plan §3.2 puts the site map in the briefing's
logistics, so the composer and renderer gain an image block in the Event section when
one is stored. Amend the guide's session 11 note.

## Folded in from session 11's review

- `CLAUDE.md`'s list of decision records is completed through ADR-0011.
- The attendee view gets a delete with a confirmation, since `deleteAttendee` has a
  cascade and a test and no caller. The confirmation says what goes with the record.
- The denylist's structural email pattern gets an allowlist for `@example.com`, so a
  contact fixture can carry an address and the briefing's email rendering is exercised.
  Say in the pattern's comment why `example.com` is safe: RFC 2606 reserves it.

## Scope guard

No `.ics` (13). No forwardable block or flag (14). No model call of any kind. No change
to the pseudonymizer or the prompt. The ruleset is used, not changed. The eval gate
should skip unless the runner's fixtures need `kind`; if it runs, say so.

## Bookkeeping

ADR-0011 in the index. Guide session 12 amended on completion with what shipped, the
site map decision, and the two settled questions; the session 11 note about the site map
corrected. Beads for whatever is found. Handoff regenerated; changelog; prompt file with
how-it-went.

## Constraints and stop conditions

As every session. Stop if: `kind` on drafts cascades into the eval runner, the audit
CSV, or the state machine in a way that changes existing behaviour; the nullable audit
fields break ADR-0008's immutability test; the site map cannot round-trip at 1600 PNG in
the e2e suite; or a premise here does not match the repository.

## Done when

ADR-0011 committed. Schema v7 migrated and tested. The composer produces one pre-event
draft per recipient, guarded, with passages exempt and a typed comparison blocked; each
draft is a `DraftRecord` with an audit record carrying null model and null template. The
location block renders two map links from stored coordinates. A site map uploads at
1600 PNG, downloads from the composer, and appears in the briefing PDF. The attendee
view deletes with confirmation. A contact fixture carries an `@example.com` address.
Unit and e2e green.

## Report back

(1) Verified versus assumed. (2) What the composed email reads like for the fixture
event — paste one, it is synthetic. (3) What the ruleset did to a typed comparison in
logistics. (4) File by file. (5) Beads, ADRs, guide amendments. (6) Flags — including
whether anything in the review surface assumed every draft had a model behind it.

## How it actually went, for whoever reuses this

**No premise was wrong.** The printout was the same day and the prompt's two decisions
were made on it. Every file, field, and function named was where it said.

**The composer never touched the generation layer, and the eval gate still runs.** The
composer lives in `src/lib/preevent/` and imports the matcher, the greeting, the ruleset,
and the hash from `src/lib/generation/` without changing any of them. The gate runs on
the PR anyway, for one watched file: the eval runner's event fixture had to gain the v7
`address` and `coordinates` fields for the typecheck. Nothing that reaches the model
changed. About sixteen cents.

**What the ruleset did to a typed comparison.** "Our console is faster than anything you
have used before." at the end of the logistics paragraph became the gap marker; the
sentences around it survived, the two passages beside it stayed exact, the flag was
`claim-bearing`, and the two hashes differed. Nothing in the location block trips a rule:
the map links, the coordinates, and "Site map attached." carry no product noun and no
descriptor, checked before the composer was written.

**Decisions made in the session rather than read.** The composed body is built once and
hashed once — it is the same for every recipient, only the greeting differs, and the
greeting is outside the rules and the hashes as it is for follow-ups. The greeting is
prepended directly rather than through `composeDraft`, whose salutation heuristic
removes a short line ending in a colon and would have eaten a typed "Arrival window:".
The subject line is "Before {event name}" and the sign-off "Kind regards," — fixed
strings until a voice profile (plan §3.3) varies them. Passages go in library order
whatever order she ticked them, so two recipients' emails are identical. The forwardable
block has a named empty placeholder and nothing else. The map links are built at six
decimals. The attendee delete uses a native confirm rather than a screen.

**The denylist allowlist is one domain.** `example.com` only, by RFC 2606; `example.org`
and `example.net` are reserved too and deliberately not allowed. Verified both ways with a
staged probe file before committing: an address at another domain beside an allowed one
still fails.

**One finding, to session 13:** fieldnote-5nc. The event has a start and no end or duration, and
an `.ics` needs both; the arrival window lives in prose.

**Not done, and said so.** No real site map has been through the resize; the twelve-
megapixel image in the end-to-end spec is a flat colour with initials, resized to
1200 by 1600 PNG and stored. The review surface's copy assumed a model in two places and
was made kind-aware; nothing in the state machine, the CSV, or the eval runner did.
