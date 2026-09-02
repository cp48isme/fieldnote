/**
 * The titles the structural rule keys on.
 *
 * The rule: a token following a title is treated as a name whether or not it matches the
 * roster. Roster matching alone cannot catch a name the roster does not know — including
 * a name device dictation mangled between the roster entry and the note — and a name the
 * tokenizer does not recognise is a name it passes through to the model. See ADR-0006.
 *
 * ONE DISTINCTION DOES ALL THE WORK. Some titles are never anything but titles, and some
 * are also ordinary nouns:
 *
 *   - `Dr`, `Dr.`, `Prof.`, `Mr.` and the rest are abbreviations. They match in any case,
 *     because dictation routinely lowercases them — `dr swali said` has to be caught, and
 *     it is exactly the input class this rule exists for.
 *   - `Doctor`, `Nurse` are ordinary English nouns. They match only when capitalised, so
 *     `Doctor Swelha` is caught and `the doctor said` is left alone. Without that split,
 *     every "the doctor recommended" in a note tokenizes its next word, which is not
 *     slight overreach — on real notes it fires constantly.
 *
 * Postfix credentials are matched after a name token. `PA`, `DO`, and `MD` are kept
 * despite being Pennsylvania, a very common verb, and Maryland: fail-closed is the point,
 * and an odd draft is cheaper than a leak. `RT` and `CST` are deliberately excluded —
 * "CST" is a timezone, both are heavily overloaded, and neither earns its false positives.
 *
 * `Sister` / `Sr` is excluded. It is a real title in UK theatre nursing and would be
 * needed for a UK deployment; the territory is US, so carrying it would be noise. Recorded
 * here and in ADR-0006 so a future UK deployment knows to put it back rather than
 * rediscovering the need.
 */

/** Titles that are never ordinary words. Matched case-insensitively. */
export const ABBREVIATED_TITLES: readonly string[] = [
  "Dr",
  "Prof",
  "Mr",
  "Mrs",
  "Ms",
  "Mx",
];

/**
 * Titles that are also ordinary nouns. Matched only when capitalised.
 *
 * `Miss` is here rather than above for the same reason: "miss the deadline".
 */
export const WORD_TITLES: readonly string[] = ["Doctor", "Professor", "Nurse", "Miss"];

/**
 * Credentials appearing after a name. Matched case-sensitively as written, because these
 * are initialisms and lowercase matching turns `do`, `pa`, and `md` into title markers.
 */
export const POSTFIX_CREDENTIALS: readonly string[] = [
  "RN",
  "NP",
  "PA",
  "PA-C",
  "APRN",
  "CRNA",
  "MD",
  "DO",
  "DDS",
  "PhD",
  "DNP",
];

function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches a title and the token after it, capturing both.
 *
 * Deliberately case-insensitive, with the case rule applied afterwards by
 * `titleQualifies`. Encoding "these alternatives are case-insensitive and those are not"
 * into one pattern needs per-character character classes, which would make the rule
 * unreadable and unreviewable — and this rule is one a reviewer has to be able to check.
 *
 * The trailing period is optional on the abbreviations because the real corpus is
 * inconsistent about it: `Dr P` in one note and `Dr. N` in another, same speaker, same
 * day. The `[A-Za-z]` opening on the captured token keeps the rule off punctuation and
 * numbers.
 */
export function titleFollowedByToken(): RegExp {
  const all = [...ABBREVIATED_TITLES, ...WORD_TITLES].map(escape).join("|");
  return new RegExp(`\\b(${all})\\.?\\s+([A-Za-z][\\w'’-]*)`, "gi");
}

/**
 * Whether a matched title actually counts, given how it was written.
 *
 * Abbreviations count in any case — dictation lowercases them, and `dr swali` is the case
 * this rule exists for. Word titles count only as written, so `Doctor Swelha` is a name
 * and `the doctor said` is prose.
 */
export function titleQualifies(matched: string): boolean {
  const bare = matched.replace(/\.$/, "");
  if (ABBREVIATED_TITLES.some((t) => t.toLowerCase() === bare.toLowerCase())) return true;
  return WORD_TITLES.includes(bare);
}

/** Case-insensitive for the abbreviations, exact for the word titles. */
export function isTitle(candidate: string): boolean {
  const bare = candidate.replace(/\.$/, "");
  if (ABBREVIATED_TITLES.some((t) => t.toLowerCase() === bare.toLowerCase())) return true;
  return WORD_TITLES.includes(bare);
}

export function isPostfixCredential(candidate: string): boolean {
  return POSTFIX_CREDENTIALS.includes(candidate.replace(/[.,]$/, ""));
}
