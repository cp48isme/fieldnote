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
| [0001](0001-public-private-split.md) | De-branded public build, private fork for production use | Accepted | 2026-08-27 |
| [0002](0002-invitation-design.md) | Attendee invitation limited to recipient-forwarded messages | Accepted | 2026-08-27 |
| [0003](0003-spreadsheet-parsing-library.md) | `read-excel-file` for spreadsheet parsing, replacing `xlsx` (SheetJS) | Accepted, amended 2026-09-01 | 2026-08-28 |
| [0004](0004-encryption-at-rest.md) | Encryption seam in the data layer; passphrase-derived encryption deferred to the private fork | Accepted, amended 2026-09-01 | 2026-09-01 |
| [0005](0005-dictation-input.md) | Device dictation only; no audio capture, storage, or transcription | Accepted, amended 2026-09-01 | 2026-09-01 |
| [0006](0006-structural-name-detection.md) | Structural name detection at the pseudonymization boundary | Accepted | 2026-09-02 |

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

## Numbering

Sequential, zero-padded to four digits, never reused. Filenames are
`NNNN-short-slug.md`. Superseded records keep their number and gain a status line
pointing at the record that replaced them.
