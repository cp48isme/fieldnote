/**
 * Role references, the third pass of the pseudonymization boundary. See ADR-0007.
 *
 * In a note about a single institution, "the Biomed Director" identifies a person as surely
 * as a surname does. Four of the seven notes in the corpus name nobody any other way. The
 * roster and title passes do not see roles, so this module does.
 *
 * TWO SOURCES OF ROLES, ONE OPEN AND ONE CLOSED.
 *
 *   - The roster. `AttendeeRecord.role` for the attendees at this event is a bounded set,
 *     and matching against it inherits roster matching's precision. A match shares the
 *     rostered person's token, because two mentions being one person is information the
 *     draft needs.
 *   - Everything else. Roles in general are an open set, grammatically indistinguishable
 *     from equipment and process nouns in the same sentence, so a list of role *phrases*
 *     would be long, incomplete on the day it was written, and would fire on ordinary
 *     prose. What is closed is the set of *head nouns* a role phrase ends in — director,
 *     coordinator, nurse, surgeon — and that is what the structural rule keys on, the way
 *     the title rule keys on a closed set of titles.
 *
 * THE STRUCTURAL RULE. A definite reference ending in a role head noun is a role:
 *
 *     the director of finance and capital     [ROLE_1]
 *     their biomed director                   [ROLE_2]
 *     Clinical Engineering Lead really likes  [ROLE_3] (sentence-initial, capitalised)
 *
 * Definiteness is the signal that a specific person is meant, and it is also what keeps the
 * rule off generic uses. Both exclusions below are the owner's decisions, recorded in
 * ADR-0007:
 *
 *   - **Plurals are left alone.** "feedback from the surgeons" refers to nobody in
 *     particular, and tokenizing it would tell the model a group is a person. Head nouns
 *     are matched in the singular with a word boundary after them, so `surgeons` never
 *     matches `surgeon`.
 *   - **Indefinite references are left alone.** "a nurse asked", "every coordinator" pick
 *     out no one, even to a reader who knows the site. Only the definite determiners in
 *     `DEFINITE` count, plus a capitalised phrase at the start of a sentence, which is how
 *     the corpus writes a role used as a name.
 *
 * THE TITLE POSITION BELONGS TO PASS 2. `Nurse` is both a word title (ADR-0006) and a role
 * head noun. Pass 2 runs first and tokenizes the word after a capitalised `Nurse`, so by the
 * time this pass runs, `Nurse Swelha` reads `Nurse [PERSON_1]`. A role head noun sitting
 * immediately before a token is being used as a title — a profession, which plan §4.1 lets
 * through the way it lets specialty through — and is left where it is. `the nurse said`,
 * lowercase, is not a title under ADR-0006's case rule and is tokenized here as a role.
 *
 * OVER-TOKENIZATION IS THE ACCEPTED DIRECTION, as in ADR-0006. "the resident" in a note
 * about a training programme, "the doctor said" where any doctor is meant, "the specialist"
 * as a job category: each becomes a token where a noun stood, and costs an odd sentence in
 * a draft a human reviews before anything is sent. A role that passes through sends
 * identity. Two head nouns are matched only when capitalised because in a device corpus
 * they are equipment far more often than people: `Head` and `Lead`.
 *
 * THIS RULE HAS LIMITS, STATED. A role phrase whose head noun is outside the list, a role
 * written without a determiner mid-sentence ("spoke to biomed director"), and a role
 * phrase carrying a verb inside its `of`-tail longer than the tail allows are all missed.
 * The head-noun list is a closed set maintained by hand, exactly as the title list is.
 */

/** Role head nouns matched in any case. Singular only; the word boundary excludes plurals. */
export const ROLE_HEADS: readonly string[] = [
  "administrator",
  "anaesthetist",
  "anesthesiologist",
  "anesthetist",
  "chair",
  "chief",
  "consultant",
  "coordinator",
  "dean",
  "director",
  "doctor",
  "engineer",
  "executive",
  "fellow",
  "manager",
  "nurse",
  "officer",
  "physician",
  "president",
  "registrar",
  "resident",
  "specialist",
  "supervisor",
  "surgeon",
  "technician",
];

/**
 * Head nouns matched only when capitalised, because lowercase they are equipment: the
 * heads on an instrument, a lead on a cable.
 */
export const CAPITALISED_ROLE_HEADS: readonly string[] = ["Head", "Lead"];

/** Initialisms for roles. Matched exactly as written, for the same reason as credentials. */
export const ROLE_INITIALISMS: readonly string[] = [
  "CEO",
  "CFO",
  "CIO",
  "CMO",
  "CNO",
  "COO",
  "CTO",
  "VP",
];

/** The determiners that make a reference definite. Matched in any case. */
export const DEFINITE: readonly string[] = [
  "the",
  "this",
  "that",
  "their",
  "our",
  "your",
  "his",
  "her",
  "my",
  "its",
];

/** Determiners that make a reference generic. A phrase after one of these is left alone. */
export const INDEFINITE: readonly string[] = [
  "a",
  "an",
  "any",
  "every",
  "each",
  "another",
  "some",
  "no",
];

/**
 * Words that cannot be part of a role phrase. This is what stops the modifier slot
 * swallowing a verb: without it, "the nurse said the director" would match as one phrase.
 * Determiners are here so that a phrase never spans two references.
 */
const NOT_A_MODIFIER: readonly string[] = [
  ...DEFINITE,
  ...INDEFINITE,
  "and",
  "or",
  "but",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "with",
  "which",
  "who",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "has",
  "had",
  "have",
  "said",
  "says",
  "asked",
  "asks",
  "told",
  "wants",
  "wanted",
  "likes",
  "liked",
  "did",
  "does",
  "do",
  "will",
  "would",
  "can",
  "could",
  "not",
  "also",
  "really",
  "then",
  "so",
  "about",
  "from",
  "as",
  "by",
  "if",
  "when",
  "while",
];

function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The exclusion list in both cases. The sentence-initial pattern cannot use the `i` flag —
 * it needs `[A-Z]` to mean capitalised — so the list carries its own capitalised forms.
 */
const EXCLUDED = NOT_A_MODIFIER.flatMap((word) => [
  word,
  word[0]!.toUpperCase() + word.slice(1),
]).join("|");

/** A word that is not on the exclusion list. `(?!...)` is a whole-word check. */
const MODIFIER_WORD = `(?!(?:${EXCLUDED})\\b)[A-Za-z][A-Za-z-]*`;

/** As above, but capitalised: the sentence-initial form writes roles as names. */
const CAPITALISED_MODIFIER_WORD = `(?!(?:${EXCLUDED})\\b)[A-Z][A-Za-z-]*`;

/** Up to three modifiers before the head noun: "the resident training coordinator". */
const MODIFIERS = `(?:${MODIFIER_WORD}\\s+){0,3}`;
const CAPITALISED_MODIFIERS = `(?:${CAPITALISED_MODIFIER_WORD}\\s+){0,3}`;

/**
 * The head noun. Case is enforced afterwards by `roleHeadQualifies`, for the reason the
 * title rule does the same: a pattern encoding "these alternatives are case-insensitive
 * and those are not" is unreviewable.
 */
const HEAD = `(?:${[...ROLE_HEADS, ...CAPITALISED_ROLE_HEADS, ...ROLE_INITIALISMS]
  .map(escape)
  .join("|")})`;

/**
 * "of finance and capital", "for training". One to four words, none from the exclusion
 * list, so the tail stops before a verb. `and` is allowed inside it deliberately.
 */
const TAIL = `(\\s+(?:of|for)\\s+${MODIFIER_WORD}(?:\\s+(?:and|&|${MODIFIER_WORD})){0,3})?`;

/**
 * A head noun sitting immediately before a token is a title, not a role, and belongs to
 * pass 2. Both the tokenizer's internal placeholder and the finished token shape are
 * checked, so the same rule reads the same in both contexts.
 */
const NOT_TITLE_POSITION = `(?!\\s+(?:\\u0000|\\[))`;

const POSSESSIVE = `(?:['’]s)?`;

/**
 * A definite role reference: determiner, optional modifiers, head noun, optional tail.
 *
 * Group 1 is the head noun, group 2 the of-tail if any, group 3 the possessive suffix if
 * any. The match includes the determiner on purpose: "[ROLE_1] asked" reads as a person to
 * the model, where "the [ROLE_1] asked" reads as a thing.
 */
export function definiteRoleReference(): RegExp {
  const determiner = `(?:${DEFINITE.join("|")})`;
  return new RegExp(
    `\\b${determiner}\\s+${MODIFIERS}(${HEAD})${TAIL}\\b${NOT_TITLE_POSITION}(${POSSESSIVE})`,
    "gi",
  );
}

/**
 * A role used as a name at the start of a sentence: "Biomed Director really likes". No
 * determiner, capitalised modifiers, then the head noun. The lookbehind is what makes it
 * sentence-initial: start of text, a line break, or sentence punctuation and a space.
 */
export function sentenceInitialRoleReference(): RegExp {
  return new RegExp(
    `(?:^|(?<=[.!?;:]\\s)|(?<=\\n\\s*))${CAPITALISED_MODIFIERS}(${HEAD})${TAIL}\\b${NOT_TITLE_POSITION}(${POSSESSIVE})`,
    "gm",
  );
}

/**
 * A roster role written as a reference: optionally after a definite determiner, never
 * after an indefinite one, singular. Group 1 is the possessive suffix if any.
 */
export function rosterRoleReference(role: string): RegExp {
  const determiner = `(?:${DEFINITE.join("|")})`;
  const indefinite = `(?:${INDEFINITE.join("|")})`;
  return new RegExp(
    `(?<!\\b${indefinite}\\s)\\b(?:${determiner}\\s+)?${escape(role)}\\b(${POSSESSIVE})`,
    "gi",
  );
}

/**
 * Whether a matched head noun counts, given how it was written. The any-case heads always
 * count; initialisms only in capitals; `Head` and `Lead` as written, or in any case when
 * an of-tail follows — "their head of procurement" is a person, "the camera head" is not.
 */
export function roleHeadQualifies(matched: string, tail: string | undefined): boolean {
  if (ROLE_HEADS.includes(matched.toLowerCase())) return true;
  if (CAPITALISED_ROLE_HEADS.includes(matched)) return true;
  if (
    tail &&
    CAPITALISED_ROLE_HEADS.some((h) => h.toLowerCase() === matched.toLowerCase())
  )
    return true;
  return ROLE_INITIALISMS.includes(matched);
}

/** Whether a roster role is specific enough to match on. */
export function rosterRoleUsable(role: string): boolean {
  return role.trim().length >= 3;
}
