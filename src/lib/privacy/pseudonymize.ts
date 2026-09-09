/**
 * The pseudonymization boundary. Names and roles do not cross it.
 *
 * Plan §4.1: the model API call is the only egress from this system, and identity does not
 * go through it. Everything sent to a model routes through this module first, and
 * `assertPseudonymized` is the check that it did.
 *
 * THREE PASSES, AND THE SECOND AND THIRD ARE THE POINT.
 *
 * 1. **Roster matching.** Every attendee's `displayName`, and the name parts inside it,
 *    are replaced with a stable token. This handles the ordinary case and the ones the
 *    build guide names: names inside prose, possessives, initials, two people sharing a
 *    surname.
 *
 * 2. **Structural detection.** A token following a title is treated as a name whether or
 *    not the roster knows it. Roster matching alone is fail-open by construction: it
 *    cannot catch what it has never seen, and the thing it has most reliably never seen is
 *    a name device dictation mangled on the way in. The one observed case is `Swali`
 *    transcribed as `Swelha` — same initial consonant, different length, different vowels.
 *    No fuzzy or phonetic matcher tuned tightly enough to stay off ordinary prose recovers
 *    that. A title is a structural signal that does not care how the name is spelled.
 *    ADR-0006 records it.
 *
 * 3. **Role references.** "the Biomed Director" identifies a person in a single-institution
 *    note as surely as a surname does, and four of the seven notes in the corpus name
 *    nobody any other way. A role on the roster shares the rostered person's token; a role
 *    the roster does not know gets its own `[ROLE_n]`. `roles.ts` carries the rule and
 *    ADR-0007 records the decision.
 *
 * THE ASYMMETRY IS DELIBERATE. The second and third passes over-tokenize: something that
 * was not a name will sometimes be replaced. That is the correct direction. Tokenizing a
 * non-name costs a slightly odd draft that a human is about to review anyway; missing a
 * real name sends identity to a third party, which is the single failure this architecture
 * exists to prevent. Read it as a decision, not an accident.
 *
 * ONE PERSON, ONE TOKEN, MANY FORMS. "Dr. Okafor", "Okafor", and "the Biomed Director" can
 * all be one attendee, and the model needs to know that three mentions are one person. So
 * a token is issued per *identity* — a rostered attendee, or, where the roster cannot say
 * which person a form belongs to, the form as written — and every form of that identity
 * gets the same token. What the token replaced at each position is remembered separately,
 * because rehydration has to put back *the form that was written there*: her name where
 * the note wrote her name, the role where it wrote the role.
 *
 * TWO KINDS OF REHYDRATION. Text this instance produced is rehydrated per occurrence, so
 * `rehydrate(pseudonymize(text)) === text` holds for every input. Anything else — a draft
 * the model wrote, in which it placed the tokens where it liked — is rehydrated with each
 * token's canonical form: the rostered person's name, or the phrase as first written. The
 * model may put a role token where a name would read better; that rehydrates faithfully
 * and reads oddly, and it is a review-gate matter (plan §4.3), not a boundary failure.
 *
 * FAIL-CLOSED DOES NOT MEAN FAILING IN FRONT OF THE USER. Nothing in the tokenizer throws
 * on unrecognised input. An unknown token after a title becomes an unknown-name token and
 * generation continues; the representative never sees an error for it.
 * `assertPseudonymized` throws, and it is an internal invariant guarding the API client —
 * if it fires, this module has a defect. A tool that refuses to draft in a car park is a
 * tool that stops being used, and a boundary around a tool nobody uses protects nothing.
 */

import type { AttendeeRecord } from "@/lib/db";
import {
  definiteRoleReference,
  roleHeadQualifies,
  rosterRoleReference,
  rosterRoleUsable,
  sentenceInitialRoleReference,
} from "./roles";
import { titleFollowedByToken, titleQualifies } from "./titles";

/**
 * Token classes.
 *
 * `HCP` and `STAFF` come from plan §4.1. `PERSON` is for a name found structurally, where
 * by definition nothing is known about whose it is. `ROLE` is for a role reference the
 * roster cannot attach to anyone.
 */
export type TokenKind = "HCP" | "STAFF" | "PERSON" | "ROLE";

export class PseudonymizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PseudonymizationError";
  }
}

export interface Pseudonymizer {
  /** Replaces names and roles with tokens. Never throws. */
  pseudonymize(text: string): string;
  /**
   * Puts the original text back. Text this instance produced comes back exactly as it went
   * in, form for form; any other text gets each token's canonical form. Unknown tokens are
   * left alone rather than failing.
   */
  rehydrate(text: string): string;
  /**
   * The token a rostered attendee is known by in this instance, issued if it has not been
   * yet. This is how a draft's recipient is named to the model: a display name that is
   * only a title and an initial has no roster form to match, so it cannot be recovered
   * from `pseudonymize` of the name alone.
   */
  tokenForAttendee(attendee: AttendeeRecord): string;
  /** Token to its canonical form: a rostered person's name, or the phrase as first written. */
  readonly mapping: ReadonlyMap<string, string>;
}

/** Matches any token this module emits. */
export const TOKEN_PATTERN = /\[(?:HCP|STAFF|PERSON|ROLE)_\d+\]/g;

/**
 * Where a token will go, until every pass has run.
 *
 * Passes run as successive replacements, and a later pass must not see an earlier pass's
 * output as text — and rehydration needs to know, per position, what was replaced there.
 * So each replacement leaves an indexed placeholder, and the final step swaps placeholders
 * for tokens left to right, recording the originals in that order. The placeholder cannot
 * be matched by any pass: it is delimited by a NUL character, and every pattern here
 * requires a letter where a placeholder would have to start.
 */
const PLACEHOLDER = /\u0000(\d+)\u0000/g;

function placeholder(index: number): string {
  return `\u0000${index}\u0000`;
}

/** Trailing possessive, straight or curly. */
const POSSESSIVE = /['’]s$/;

/**
 * Classifies a roster attendee.
 *
 * `specialty` is populated for clinicians and empty for coordinators and engineers, so it
 * is the field that already carries this distinction — inventing a new one would be a
 * schema change for a cosmetic difference. It is a heuristic and it costs nothing when
 * wrong: both tokens are opaque, and the only consequence of a misclassification is that
 * the model is told "a clinician" where it should have been told "a colleague".
 */
function classify(attendee: AttendeeRecord): TokenKind {
  return attendee.specialty.trim() ? "HCP" : "STAFF";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The display name with titles removed: what a token rehydrates to in a draft. */
function canonicalNameOf(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter((part) => !titleQualifies(part.replace(/\.$/, "")))
    .join(" ")
    .trim();
}

/**
 * Every string that should be recognised as this attendee, longest first.
 *
 * The full display name, then the individual name parts. Titles and single initials are
 * dropped: `Dr` is not a name, and a bare `A` would match the indefinite article and every
 * standalone capital in the note. Initials still tokenize when they appear after a title,
 * via the structural pass, which is where they carry a name's weight.
 */
function nameFormsOf(displayName: string): string[] {
  const withoutTitles = canonicalNameOf(displayName);

  const parts = withoutTitles
    .split(/\s+/)
    .map((part) => part.replace(/[.,]$/, ""))
    .filter((part) => part.length > 1);

  const forms = new Set<string>();
  if (withoutTitles.length > 1) forms.add(withoutTitles);
  for (const part of parts) forms.add(part);

  return [...forms].sort((a, b) => b.length - a.length);
}

/**
 * A roster form written as a name, not as an ordinary word.
 *
 * Matching is case-insensitive except for the first letter, which must be capitalised.
 * That one rule is what separates `Dr. Green confirmed the dates` from `the green light on
 * the console` without a dictionary of which surnames are also words — English capitalises
 * names, so a lowercase occurrence is either an ordinary word or dictation that dropped the
 * case. The second of those is not lost: dictation that lowercases a name almost always
 * keeps the title in front of it, and the structural pass catches it there.
 */
function writtenAsName(occurrence: string): boolean {
  const first = occurrence[0];
  return first !== undefined && first === first.toUpperCase() && /[A-Za-z]/.test(first);
}

function splitPossessive(value: string): { bare: string; suffix: string } {
  const match = POSSESSIVE.exec(value);
  if (!match) return { bare: value, suffix: "" };
  return { bare: value.slice(0, match.index), suffix: match[0] };
}

/**
 * Who a form belongs to.
 *
 * A form belonging to exactly one attendee is keyed on that attendee, so every form of the
 * same person shares a token. A form two attendees share — both `Vance`s — is keyed on the
 * text as written: the tokenizer never has to decide something it cannot know, and the
 * note is restored exactly as written. Structural finds are keyed on their text too, in
 * lower case, because dictation is inconsistent about case and `swelha` and `Swelha` are
 * one person.
 */
interface Identity {
  key: string;
  kind: TokenKind;
  /** What the token stands for in text this instance did not produce. */
  canonical: string;
}

function attendeeIdentity(attendee: AttendeeRecord): Identity {
  return {
    key: `attendee:${attendee.id}`,
    kind: classify(attendee),
    canonical: canonicalNameOf(attendee.displayName),
  };
}

function textIdentity(kind: TokenKind, written: string): Identity {
  return { key: `text:${kind}:${written.toLowerCase()}`, kind, canonical: written };
}

/**
 * The forms of a field across the roster, each attributed to one owner or to none.
 *
 * Longest first, so "Peter Vance" is consumed before the bare "Vance" can claim half of
 * it. Roster order decides the class a shared form receives, so it is deterministic.
 */
function rosterFormsOf(
  attendees: readonly AttendeeRecord[],
  formsOf: (attendee: AttendeeRecord) => string[],
): Array<{ form: string; identity: Identity }> {
  const holders = new Map<string, { form: string; owners: AttendeeRecord[] }>();
  for (const attendee of attendees) {
    for (const form of formsOf(attendee)) {
      const key = form.toLowerCase();
      const entry = holders.get(key) ?? { form, owners: [] };
      entry.owners.push(attendee);
      holders.set(key, entry);
    }
  }

  return [...holders.values()]
    .map(({ form, owners }) => {
      const first = owners[0]!;
      const identity =
        owners.length === 1
          ? attendeeIdentity(first)
          : textIdentity(classify(first), form);
      return { form, identity };
    })
    .sort((a, b) => b.form.length - a.form.length);
}

export function createPseudonymizer(attendees: readonly AttendeeRecord[]): Pseudonymizer {
  const mapping = new Map<string, string>();
  /** Identity key to the token already issued for it, so repeats stay stable. */
  const issued = new Map<string, string>();
  const counters: Record<TokenKind, number> = { HCP: 0, STAFF: 0, PERSON: 0, ROLE: 0 };
  /** Every output this instance has produced, with what each token replaced, in order. */
  const produced = new Map<string, Array<{ token: string; original: string }>>();

  function tokenFor(identity: Identity): string {
    const existing = issued.get(identity.key);
    if (existing) return existing;

    counters[identity.kind] += 1;
    const token = `[${identity.kind}_${counters[identity.kind]}]`;
    issued.set(identity.key, token);
    mapping.set(token, identity.canonical);
    return token;
  }

  const rosterNames = rosterFormsOf(attendees, (a) => nameFormsOf(a.displayName));
  const rosterRoles = rosterFormsOf(attendees, (a) =>
    rosterRoleUsable(a.role) ? [a.role.trim()] : [],
  );

  function pseudonymize(text: string): string {
    const held: Array<{ token: string; original: string }> = [];
    const hold = (original: string, identity: Identity): string => {
      held.push({ token: tokenFor(identity), original });
      return placeholder(held.length - 1);
    };

    let output = text;

    // Pass 1 — roster names.
    //
    // A form shared by two attendees is tokenized against the text that was written, not
    // against a guess at which person was meant: both `Vance`s become the same token,
    // which rehydrates to `Vance`. The note is restored exactly as written and the
    // tokenizer never has to decide something it cannot know.
    for (const { form, identity } of rosterNames) {
      const pattern = new RegExp(`\\b${escapeRegExp(form)}\\b(?:['’]s)?`, "gi");
      output = output.replace(pattern, (match) => {
        if (!writtenAsName(match)) return match;
        const { bare, suffix } = splitPossessive(match);
        return hold(bare, identity) + suffix;
      });
    }

    // Pass 2 — a token after a title is a name, known or not.
    //
    // A name already replaced in pass 1 cannot match here: the captured token has to start
    // with a letter, and a placeholder starts with a control character.
    output = output.replace(
      titleFollowedByToken(),
      (match: string, title: string, following: string) => {
        if (!titleQualifies(title)) return match;

        const { bare, suffix } = splitPossessive(following);
        const separator = match.slice(title.length, match.length - following.length);
        return `${title}${separator}${hold(bare, textIdentity("PERSON", bare))}${suffix}`;
      },
    );

    // Pass 3a — roles on the roster share the rostered person's token.
    for (const { form, identity } of rosterRoles) {
      output = output.replace(
        rosterRoleReference(form),
        (match: string, suffix: string) => {
          return hold(match.slice(0, match.length - suffix.length), identity) + suffix;
        },
      );
    }

    // Pass 3b — a definite role reference the roster does not know gets its own token.
    //
    // Two shapes, the same rule: after a definite determiner anywhere, or capitalised at
    // the start of a sentence. Pass 2 has already run, so a head noun in the title
    // position — `Nurse [PERSON_1]` — is skipped by the pattern itself.
    for (const pattern of [definiteRoleReference(), sentenceInitialRoleReference()]) {
      output = output.replace(
        pattern,
        (match: string, head: string, tail: string | undefined, suffix: string) => {
          if (!roleHeadQualifies(head, tail)) return match;
          const bare = match.slice(0, match.length - suffix.length);
          return hold(bare, textIdentity("ROLE", bare)) + suffix;
        },
      );
    }

    // Placeholders become tokens, left to right, and the order is what rehydration uses.
    const ordered: Array<{ token: string; original: string }> = [];
    const result = output.replace(PLACEHOLDER, (_, index: string) => {
      const entry = held[Number(index)]!;
      ordered.push(entry);
      return entry.token;
    });
    produced.set(result, ordered);
    return result;
  }

  function rehydrate(text: string): string {
    const exact = produced.get(text);
    if (exact) {
      let position = 0;
      return text.replace(TOKEN_PATTERN, (token) => {
        const entry = exact[position++];
        return entry?.token === token ? entry.original : (mapping.get(token) ?? token);
      });
    }
    return text.replace(TOKEN_PATTERN, (token) => mapping.get(token) ?? token);
  }

  function tokenForAttendee(attendee: AttendeeRecord): string {
    return tokenFor(attendeeIdentity(attendee));
  }

  return { pseudonymize, rehydrate, tokenForAttendee, mapping };
}

/**
 * The guard on the API client. Throws if anything name-shaped or role-shaped survived.
 *
 * This is an invariant, not a user-facing validation. Every path reaching it has already
 * been through `pseudonymize`, so a throw means this module has a defect — exactly when a
 * loud failure is wanted, and exactly when the representative is not the person to tell.
 *
 * It re-derives what a name and a role look like rather than trusting that a function was
 * called, so removing the tokenizer's structural pass or its role pass makes this fail. A
 * guard that only checks its own bookkeeping is not a guard.
 */
export function assertPseudonymized(
  text: string,
  attendees: readonly AttendeeRecord[],
): void {
  const offenders: string[] = [];

  for (const attendee of attendees) {
    for (const form of nameFormsOf(attendee.displayName)) {
      const pattern = new RegExp(`\\b${escapeRegExp(form)}\\b`, "gi");
      for (const match of text.matchAll(pattern)) {
        if (writtenAsName(match[0])) {
          offenders.push(`roster name (${form.length} chars)`);
          break;
        }
      }
    }
    const role = attendee.role.trim();
    if (rosterRoleUsable(role) && rosterRoleReference(role).test(text)) {
      offenders.push(`roster role (${role.length} chars)`);
    }
  }

  for (const match of text.matchAll(titleFollowedByToken())) {
    const [, title, following] = match;
    if (!titleQualifies(title)) continue;
    offenders.push(`untokenized name after a title (${following.length} chars)`);
  }

  for (const pattern of [definiteRoleReference(), sentenceInitialRoleReference()]) {
    for (const match of text.matchAll(pattern)) {
      const [whole, head, tail] = match;
      if (!roleHeadQualifies(head, tail)) continue;
      offenders.push(`untokenized role reference (${whole.length} chars)`);
    }
  }

  if (offenders.length > 0) {
    // Lengths, never the text. This message reaches logs and terminals, and echoing the
    // name would put it exactly where this module exists to keep it out of.
    throw new PseudonymizationError(
      `Refusing to send untokenized content to the model: ${offenders.join("; ")}`,
    );
  }
}
