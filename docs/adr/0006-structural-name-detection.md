# ADR-0006: Structural name detection at the pseudonymization boundary

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** cp48isme (owner)

## Context

Project plan §4.1 states that the model API call is the only egress from this system and
that identity does not cross it. Until this record, the mechanism implied by that section
was roster matching: attendee names are known from the event roster, so replace them with
stable tokens before the call and rehydrate afterwards.

Roster matching is fail-open by construction. It replaces the names it has been told
about and passes everything else through unchanged. A name it has not been told about is
not flagged, not blocked, and not visible — it is simply sent.

That gap is not hypothetical, and ADR-0005 is the reason. Capture accepts device
dictation, which reaches the application as ordinary text with no indication that it was
dictated and no source recording to check against. Dictation mangles surnames. When it
does, the string in the note is not the string on the roster, and roster matching cannot
connect them.

**The evidence, stated with its size.** One phone dictation test: five surnames spoken,
four transcribed correctly, one rendered `Swelha` from a spoken `Swali`. That sample is
too small to support a frequency claim, and it is recorded here because its *shape* is
what matters rather than its rate:

- **Rare**, so the representative is not watching for it. A failure that happened on every
  name would be noticed and corrected in the field. One in five, arriving mid-event, is
  not.
- **Severe**, so approximate matching does not recover it. `Swali` and `Swelha` share an
  initial consonant and nothing else usable: different length, different vowels, different
  ending. An edit-distance or phonetic matcher loose enough to connect them fires
  constantly on ordinary prose.

The build guide asserts more strongly that dictation "will mangle surnames". The evidence
available supports *rare and severe* rather than constant, which does not weaken the
conclusion — it sharpens it. A rare, severe failure is a worse control problem than a
frequent, mild one.

## Decision

**The pseudonymization boundary is roster matching plus structural detection plus a
fail-closed guard, not roster matching alone.**

Three parts, in `src/lib/privacy/`:

1. **Roster matching.** Attendee `displayName` values and the name parts within them are
   replaced with stable tokens. A form matches case-insensitively except for its first
   letter, which must be capitalised — the rule that separates `Dr. Green confirmed the
   dates` from `the green light on the console` without a dictionary of which surnames are
   also ordinary words.

2. **Structural detection.** A token following a title is treated as a name whether or not
   it matches the roster, and is tokenized as an unknown person. A title is a structural
   signal that does not depend on the spelling of the name after it, which is exactly the
   property roster matching lacks.

   Titles divide by whether they are ever ordinary words. `Dr`, `Prof`, `Mr`, `Mrs`, `Ms`,
   `Mx` match in any case, because dictation lowercases them and `dr swali` is the input
   class this rule exists for. `Doctor`, `Professor`, `Nurse`, `Miss` match only when
   capitalised, because `the doctor said` is prose and a rule that tokenized its next word
   would fire on almost every note.

   Postfix credentials — `RN`, `NP`, `PA`, `PA-C`, `APRN`, `CRNA`, `MD`, `DO`, `DDS`,
   `PhD`, `DNP` — are recognised after a name. `PA`, `DO`, and `MD` are kept despite being
   Pennsylvania, a common verb, and Maryland. `RT` and `CST` are excluded: both are
   overloaded past usefulness and `CST` is a timezone. `Sister` / `Sr` is excluded as
   US-territory noise; it is a genuine title in UK theatre nursing and a UK deployment
   should restore it.

3. **A guard on the API client.** `assertPseudonymized` re-derives what a name looks like
   and throws if anything name-shaped survived. It does not check that the tokenizer ran;
   it checks the text, so removing the structural pass makes it fail.

### The asymmetry is deliberate

Structural detection over-tokenizes. Some token after a title will be replaced that was
not a name.

**That is the correct direction, and it is a decision rather than a tolerated defect.**
Tokenizing a non-name costs a slightly odd sentence in a draft that a human is about to
read before anything is sent. Missing a real name sends the identity of a healthcare
professional to a third-party model, which is the single failure the entire architecture
of §4.1 exists to prevent. The costs are not comparable and the design should not pretend
they are.

### Fail-closed is not the same as failing in front of the user

Fail-closed here means *tokenize more*, never *refuse to draft*. The distinction is
load-bearing, because a tool that errors in a car park is a tool that stops being used,
and a boundary around an unused tool protects nothing.

The complete set of conditions that can surface an error to the representative is
therefore: **none from this module.** The tokenizer does not throw on any input. An
unrecognised token after a title becomes an unknown-name token and generation continues.
Rehydration leaves a token it does not recognise in place rather than failing, so a model
that invents `[HCP_9]` produces one odd string in a draft rather than a lost draft.

`assertPseudonymized` throws, and it is an internal invariant, not a validation of user
input. Every path that reaches it has already been through the tokenizer, so a throw means
this module has a defect. That is precisely when a loud failure is wanted and precisely
when the representative is not the person who should receive it. Session 5, which owns the
route that calls it, is responsible for ensuring it surfaces as a defect report to the
developer rather than as a failure to the user.

## Alternatives considered

**Roster matching alone.** The implied design before this record, and the smallest thing
that could work.

Rejected because it silently passes the case it cannot see. Its failure mode is the worst
available: no error, no flag, no visible difference between "there was no name here" and
"there was a name here and I did not recognise it". The dictated-input channel guarantees
that case will occur, and ADR-0005 accepted that channel deliberately.

**Fuzzy or phonetic matching against the roster.** Edit distance, Soundex, Metaphone, or a
similar approximate matcher, so that a mangled name still matches the roster entry it came
from.

Rejected on the observed evidence. `Swali` → `Swelha` is a two-character overlap at the
start and nothing else: any threshold loose enough to match them also matches a large
fraction of ordinary English words, and this corpus is full of ordinary English words that
sit next to names. The failure mode is also wrong in a subtle way — a fuzzy matcher tuned
until it stops firing on prose has been tuned until it stops catching manglings, and it
will still look like it is working. Structural detection does not depend on the spelling
at all, which is the property that survives dictation.

**A curated list of surnames, or a named-entity model.** Rejected without extended
analysis. A list cannot contain the name it has not met, which is the same failure as
roster matching. A named-entity model would be a second inference dependency inside the
control that exists to constrain the first one, and — depending on where it ran — a second
egress, which §4.1 does not permit.

## Consequences

**Positive**

- The boundary no longer depends on having been told a name in advance, which is the one
  assumption dictation reliably breaks.
- The rule is small enough to review. Two passes, one capitalisation rule, one title list,
  stated in a paragraph each.
- The guard is falsifiable: removing the structural pass makes a test fail, and that
  counterfactual is demonstrated in `tests/unit/pseudonymize.test.ts` rather than asserted.
- Nothing in the boundary can produce a user-facing error, so the control does not create
  a reason to work around it.

**Negative**

- Drafts will occasionally contain a token where an ordinary word stood. Accepted, per the
  asymmetry above.
- The title list is a closed set maintained by hand, and a title outside it is a gap.
  `Sister` is a known, deliberate example.

**Residual risk, stated plainly**

- **Roles are not covered.** Real notes refer to people as "the Biomed Director", "the
  CEO", "the resident coordinator". In a note about a single institution these identify a
  person as certainly as a surname does, and neither pass sees them. Four of the seven
  notes in the available corpus name nobody any other way. This is the largest remaining
  hole in §4.1's claim and it is tracked as `fieldnote-q0h`, to be decided before session 5
  wires generation to this boundary.
- **A name with no title and no roster entry is not detected.** A mangled surname written
  without `Dr.` in front of it passes both passes. The structural rule closes the common
  case, not the general one.
- **The mangling evidence is five names.** One severe failure and four clean transcriptions
  is enough to establish that the failure exists and what shape it has. It is not enough to
  characterise its frequency, and no claim about frequency should be built on it.
- **The HCP/STAFF distinction is a heuristic.** An attendee with a non-empty `specialty` is
  classified `HCP`, otherwise `STAFF`. The schema carries no field stating whether someone
  is a clinician, and adding one would be a schema change for a cosmetic difference. Both
  tokens are opaque, so a misclassification costs nothing in protection.
