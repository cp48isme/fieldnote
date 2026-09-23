# Architecture Decision Records

Decisions that shaped Fieldnote, with the reasoning intact — including the options that
were rejected and why.

Records are immutable once accepted. A decision that changes is **superseded** by a new
record rather than edited; a record that gains a consequence without changing its
decision is **amended** with a dated note in place. Neither is rewritten silently. In a
repository whose subject is governance, the audit trail of its own decisions is part of
the artifact.

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-public-private-split.md) | De-branded public build, private fork for production use | Accepted, amended 2026-09-17 | 2026-08-27 |
| [0002](0002-invitation-design.md) | Attendee invitation limited to recipient-forwarded messages | Accepted, amended 2026-09-15 | 2026-08-27 |
| [0003](0003-spreadsheet-parsing-library.md) | `read-excel-file` for spreadsheet parsing, replacing `xlsx` (SheetJS) | Accepted, amended 2026-09-01 and 2026-09-14 | 2026-08-28 |
| [0004](0004-encryption-at-rest.md) | Encryption seam in the data layer; passphrase-derived encryption deferred to the private fork | Accepted, amended 2026-09-01, 2026-09-11, 2026-09-15, and 2026-09-23 | 2026-09-01 |
| [0005](0005-dictation-input.md) | Device dictation only; no audio capture, storage, or transcription | Accepted, amended 2026-09-01 | 2026-09-01 |
| [0006](0006-structural-name-detection.md) | Structural name detection at the pseudonymization boundary | Accepted, amended 2026-09-09 | 2026-09-02 |
| [0007](0007-role-references.md) | Role references at the pseudonymization boundary | Accepted | 2026-09-09 |
| [0008](0008-audit-records-survive-event-deletion.md) | Audit records survive event deletion | Accepted, amended 2026-09-11 and 2026-09-14 | 2026-09-11 |
| [0009](0009-briefing-is-downloaded-never-sent.md) | The briefing is a document the representative writes and downloads; the application lays it out and never sends it | Accepted | 2026-09-14 |
| [0010](0010-pdf-generation-library.md) | `pdf-lib` for producing the briefing document | Accepted | 2026-09-15 |
| [0011](0011-pre-event-email-is-a-draft.md) | A pre-event email is a draft under the review gate, model or not | Accepted | 2026-09-15 |
| [0012](0012-deployment-on-vercel.md) | Deployment on Vercel, and who may call the generation route | Accepted, amended 2026-09-22 | 2026-09-21 |
| [0013](0013-retention-of-the-local-store.md) | Retention of the local store | Accepted | 2026-09-17 |

## What each one settles

**0001** is the record everything else sits on: one codebase, two configurations, no real
branding or real people in the public repository or its history.

**0002** takes the narrowest of three invitation designs and documents the rejection of
the other two. The rejected options are the substance of the record.

**0003** replaces a dependency carrying two unpatched high-severity advisories that no
registry update resolves, and prefers a parser that structurally cannot write files.

**0004** declines to build a control. Passphrase-derived encryption at rest closes one
row of a five-row threat table and introduces a permanent data-loss path into the exact
workflow the project exists to make reliable. The seam is built; the cryptography is
deferred to the private fork.

**0005** declines a capability. No microphone permission, no audio, no transcription
service — because a transcription call would be a second egress, and the single-egress
claim in project plan §4.1 is the strongest thing in the repository.

**0006** widens what the pseudonymization boundary means: roster matching plus structural
detection plus a fail-closed guard, rather than roster matching alone, which cannot catch
a name it was never told about. It records a deliberate asymmetry — over-tokenizing is
preferred to under-tokenizing — and is explicit that fail-closed means tokenizing more,
never refusing to draft.

**0007** closes 0006's largest residual risk. A role reference — "the Biomed Director" —
identifies a person in a single-institution note as surely as a surname, so the boundary
gains a third pass: roles on the roster share the rostered person's token, roles the roster
does not know are tokenized fail-closed on a closed list of head nouns, plurals and
indefinite references are left alone, and rehydration puts back the form that was written
at each position. It records why the model's placement of a role token is a review-gate
matter rather than a boundary failure.

**0008** records a session 2 decision that had lived in a source comment: deleting an
event spares its audit records, so a cleanup action cannot destroy the audit trail. It
states the consequence that follows — a record must carry everything an auditor needs,
because after deletion it is all that remains — and it decides what the record's two
hashes are taken over, so that neither reconstructs only against text containing a name.

**0009** decides the briefing's distribution path before anything is built: the
application lays the document out from what the representative enters and offers it as
a download; it never sends it, the model writes none of it, and deal positioning has no
home in the public build. It withdraws plan §3.2's suggested openers and selected talking
points rather than deferring them.

**0010** chooses the library that draws the briefing, in 0003's shape: three candidates,
the registry and advisory material for each, and the deciding reason — the smaller thing
to trust, a library of primitives with no script, form, or HTML capability — set against
the cost it carries, which is that it is unmaintained and the record says so.

**0013** turns ADR-0004's mitigation into behaviour. An event's content is deleted thirty
days after the event ends, keyed on when it ended and falling back to when it started and
then to when its record was last written; a notice appears from day twenty-three with the
date; her own delete is unchanged; audit records are never pruned; and the periods are
build-time constants. Nothing is stored to make it work, so the schema does not move, and
the record states the two things that costs. It also records the owner's first decision —
prompted, with a sixty-day ceiling — as superseded, and why: the correspondence that
matters has already left by mail client, so the application's copy is working material and
an export prompt offers a second copy of something she has.

**0012** settles where the application runs and who may call the route that spends
money, which are one decision because each depends on the other. The private build
deploys first, to its own project on a personal account on the Pro plan — Hobby's terms
permit non-commercial use only. Preview and every non-production URL are protected, and
the model key is scoped to Production, so two things must fail before a preview can spend.
Analytics and the toolbar are off, and the record is honest about which of them the
content security policy would actually block. One region, `iad1`, in `vercel.json`. The
route gains a caller key, held as a hash on the server and carried in an `HttpOnly`
cookie set by a form, so nothing about it is in IndexedDB or readable by a script; there
is no rate limit in code, because a per-instance counter is not a ceiling and a spend
limit on the API key is.

**0011** settles the two questions plan §3.3 left open for the pre-event email: it is a
draft under the review gate, with an audit record carrying a null model, because the gate
exists for what leaves the device and not for what the model did; and the ruleset judges
the whole email, the representative's own paragraph included, because §4.2 is about what
is claim-bearing and not who wrote it.

## Numbering

Sequential, zero-padded to four digits, never reused. Filenames are
`NNNN-short-slug.md`. Superseded records keep their number and gain a status line
pointing at the record that replaced them.
