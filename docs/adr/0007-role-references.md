# ADR-0007: Role references at the pseudonymization boundary

- **Status:** Accepted
- **Date:** 2026-09-09
- **Deciders:** cp48isme (owner); detection design and rehydration mechanism by the session
  that implemented it, on the owner's policy

## Context

ADR-0006 widened the pseudonymization boundary to roster matching plus structural name
detection plus a fail-closed guard, and stated its largest residual risk plainly: **roles
are not covered.** Real dictated notes refer to people as "the Biomed Director", "the CEO",
"the resident coordinator". In a note about a single institution there is one of each per
site, and anyone who knows the site knows who is meant. Four of the seven notes in the
corpus (plan §7 item 2) name nobody any other way. A role reaching the model is the same
failure as a name reaching it, and plan §4.1 says identity does not cross that boundary.

`fieldnote-q0h` recorded the shape of the problem and why it is harder than the title rule.
A title is a closed set that appears immediately before its name, so the structural rule
is a two-token pattern. Roles are an open set, appear as ordinary noun phrases, and are
grammatically indistinguishable from equipment and process nouns in the same sentence. A
list of role phrases would be long, incomplete on the day it was written, and would fire
on ordinary prose.

Session 5 wires generation to the boundary, so this had to be decided first. The owner
decided the policy on 2026-09-08 and left the detection mechanism and the rehydration
mechanism to the implementing session.

## Decision

**The boundary gains a third pass: role references are tokenized.**

### Policy, decided by the owner

1. **Roles are matched against `AttendeeRecord.role` for the attendees at this event.** A
   role matching exactly one rostered person **shares that person's token** — "Dr. Okafor"
   and "the Biomed Director" are one `[HCP_1]`, because two mentions being one person is
   information the draft needs. A role two rostered people hold is tokenized against the
   text as written, the way a surname two attendees share already is: the tokenizer never
   decides something it cannot know.
2. **A role matching nobody on the roster gets its own token, `[ROLE_n]`**, fail-closed on
   the asymmetry ADR-0006 records. An over-tokenized noun costs an odd sentence in a draft
   a human reviews; a role that passes through sends identity.
3. **Plural generics are left alone.** "feedback from the surgeons", "the residents" refer
   to nobody in particular and appear across the corpus. Tokenizing them would tell the
   model a group is a person. Head nouns are matched in the singular with a word boundary
   after them, so `surgeons` never matches `surgeon`.
4. **Rehydration is per occurrence.** A shared token must come back as *the form that was
   written there*: her name where the note wrote her name, the role where it wrote the
   role. Every existing test's invariant, `rehydrate(pseudonymize(text)) === text`, still
   holds.

### Detection, designed by the session

**Roles on the roster** are matched as written, case-insensitively, optionally after a
definite determiner and never after an indefinite one, singular only. This is roster
matching and inherits its precision.

**Roles the roster does not know** are found structurally, in `src/lib/privacy/roles.ts`.
What is closed is not the set of role phrases but the set of *head nouns* a role phrase
ends in — director, coordinator, manager, nurse, surgeon, registrar and so on — and that is
what the rule keys on, the way the title rule keys on a closed set of titles. Two shapes
count as a role:

- **A definite reference anywhere:** a definite determiner (`the`, `their`, `our`, `his`,
  `her`, …), up to three modifier words, a head noun, and an optional `of`/`for` tail of up
  to four words — "the director of finance and procurement", "their head of procurement",
  "the resident training coordinator". The determiner is inside the match on purpose:
  `[ROLE_1] asked` reads as a person to the model where `the [ROLE_1] asked` reads as a
  thing.
- **A capitalised phrase opening a sentence:** "Clinical Engineering Lead really likes",
  "Biomed Director has concerns". No determiner, because that is how the corpus writes a
  role used as a name.

**Indefinite references are excluded.** "a nurse asked", "any coordinator could answer"
pick out no one, even to a reader who knows the site. Definiteness is the signal that a
specific person is meant, and it is also the line between a reference and a generic use.
This is the owner's "generic uses" exclusion made mechanical: definite or sentence-initial
counts, indefinite does not.

**The modifier slot and the tail are bounded by an exclusion list**, not by grammar. A
list of words that cannot be part of a role phrase — determiners, conjunctions,
prepositions, reporting verbs — is what stops "the nurse said the director" matching as
one phrase, and what stops "the director of finance said that" swallowing the verb. The
list is closed and maintained by hand, exactly as the title list is.

**Two head nouns match only when capitalised or carrying an `of`-tail: `Head` and
`Lead`.** In a device corpus they are equipment far more often than people ("the heads
are interchangeable", "the lead runs under the cart"). "Their head of procurement" is a
person and matches because of the tail.

### The `Nurse` collision

`Nurse` is a word title under ADR-0006 and a role head noun here. Pass 2 runs first and
owns the title position: by the time the role pass runs, "Nurse Swelha" reads
`Nurse [PERSON_1]`. **A head noun sitting immediately before a token is a title and is left
where it is** — a profession, which plan §4.1 lets through the way it lets specialty
through. "the nurse said", lowercase, is not a title under ADR-0006's case rule and is
tokenized here as a definite role reference. The same rule means "Nurse Manager asked"
keeps `Nurse` and tokenizes `Manager` as a person: an odd token, and the accepted
direction.

### Per-occurrence rehydration

`Pseudonymizer.mapping` is `token → one string` and cannot express "the name here, the
role there". The module was changed rather than the interface:

- **Tokens are issued per identity, not per string.** A rostered attendee is one identity
  whatever form the note uses; a form shared by two attendees, a structurally found name,
  and an unmatched role are each an identity keyed on their text. Before this record the
  full name and the surname of the same person received two tokens, which told the model
  two people were in the room.
- **Each pass leaves an indexed placeholder rather than the token itself.** When every
  pass has run, placeholders become tokens left to right and the originals are recorded
  in that order against the output string. That is the whole mechanism: the instance
  remembers, for each string it produced, what each token replaced at each position.
- **`rehydrate` has two paths.** Text the instance produced comes back form for form —
  the exact round-trip. Anything else — a draft, in which the model placed tokens where it
  liked — is rehydrated with each token's canonical form: a rostered person's name with
  titles removed, or the phrase as first written, or the roster's own form for a shared
  one. `mapping` now holds those canonical forms and keeps its type.

### One consequence to state rather than discover

The model receives tokens and may place them where a writer would not have. A role token
landing where a name reads better — "Dear the director of finance" — rehydrates faithfully
and still reads oddly. **That is a review-gate matter (plan §4.3), not a boundary
failure**, and the owner accepts it. The prompt template tells the model which tokens are
names and which are roles so it can choose, and the review gate exists for what it gets
wrong.

## Alternatives considered

**Distinct tokens for a role and the person it refers to.** Simpler: no identity keying,
no per-occurrence memory. Rejected because it loses the fact that two mentions are one
person, which is information the draft needs — a follow-up that thanks `[HCP_1]` and
separately mentions `[ROLE_1]`'s concerns is writing to two people.

**A list of role phrases.** Rejected for the reason the bead gave: long, incomplete on the
day it was written, and firing on prose. Keying on head nouns keeps the closed set short
enough to review in a paragraph while covering an open set of phrases.

**A determiner followed by any noun phrase, with no head-noun list.** The bead's own
starting suggestion, taken further. Rejected because it tokenizes every definite noun
phrase in a note — "the open control panel", "the sensor set", "the probe port size" — and
a draft in which every object is a person-token is unusable, which is a different way for
a boundary to protect nothing.

**A named-entity model.** Rejected without extended analysis, as in ADR-0006: a second
inference dependency inside the control that constrains the first, and depending on where
it ran, a second egress.

**Positional information inside the token** — `[HCP_1:3]` or similar — so the token itself
says which occurrence it is. Rejected because the token is the thing the model sees and
copies, and a model that drops or rewrites a suffix turns exact rehydration into a guess.
The token format is unchanged; the memory lives in the instance.

**Aligning the draft's tokens to the note's occurrences.** Rejected because a draft is not
a permutation of the note. The model adds mentions, drops them, and reorders them; any
alignment is a heuristic that will be wrong silently. A draft gets canonical forms, and
the review gate reads the result.

## Consequences

**Positive**

- The largest residual risk in ADR-0006 is closed for the cases the corpus actually
  contains: every role reference in the seven adapted notes tokenizes, and the plurals in
  them do not.
- One person is one token across name, surname, initial-after-title, and role, within a
  note and across a batch when one instance is reused.
- The guard re-derives the role rule, so removing the role pass makes
  `tests/unit/pseudonymize.test.ts` fail. The counterfactual is demonstrated there.
- Nothing in the pass can surface an error to the representative. Fail-closed still means
  tokenize more, never refuse to draft.

**Negative**

- More odd sentences. "the doctor said", "the resident", "the specialist" become tokens
  where a job category may have been meant. Accepted, per the asymmetry.
- A roster role written immediately before a rostered name — "Consultant Okonjo-Baptiste" —
  tokenizes both and the model sees the same token twice in a row. Harmless, ugly, and
  rehydrates exactly.
- `tests/unit/pseudonymize.test.ts` carried a test asserting roles were *not* tokenized,
  citing `fieldnote-q0h` as a known gap, and the fixtures a matching note. Both were
  inverted deliberately and say so in their comments.

**Residual risk, stated plainly**

- **The head-noun list is closed.** A role whose head noun is outside it — "the theatre
  matron", "the scrub tech" — is missed unless it is on the roster. Same class of gap as a
  title outside the title list.
- **A role written mid-sentence without a determiner is missed.** "spoke to biomed director
  about the cart" passes both shapes. The corpus does not contain this form; it may exist.
- **The exclusion list is a heuristic.** A verb it does not name, sitting directly between a
  determiner and a head noun, or inside an `of`-tail, becomes part of the role phrase. The
  cost is a longer token span, not a leak.
- **The roster's own role strings decide precision.** A role field holding a generic word
  ("Staff", "Admin") matches every use of that word. Roster import (session 8) should
  treat the role column as the tokenizer's input, because it is.
