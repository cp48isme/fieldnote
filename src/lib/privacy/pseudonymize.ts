/**
 * The pseudonymization boundary. Names do not cross it.
 *
 * Plan §4.1: the model API call is the only egress from this system, and identity does not
 * go through it. Everything sent to a model routes through this module first, and
 * `assertPseudonymized` is the check that it did.
 *
 * TWO PASSES, AND THE SECOND IS THE POINT.
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
 *
 * THE ASYMMETRY IS DELIBERATE. The second pass over-tokenizes: something that was not a
 * name will sometimes be replaced. That is the correct direction. Tokenizing a non-name
 * costs a slightly odd draft that a human is about to review anyway; missing a real name
 * sends identity to a third party, which is the single failure this architecture exists to
 * prevent. Read it as a decision, not an accident. ADR-0006 records it.
 *
 * FAIL-CLOSED DOES NOT MEAN FAILING IN FRONT OF THE USER. Nothing in the tokenizer throws
 * on unrecognised input. An unknown token after a title becomes an unknown-name token and
 * generation continues; the representative never sees an error for it.
 * `assertPseudonymized` throws, and it is an internal invariant guarding the API client —
 * if it fires, this module has a defect. A tool that refuses to draft in a car park is a
 * tool that stops being used, and a boundary around a tool nobody uses protects nothing.
 */

import type { AttendeeRecord } from "@/lib/db";
import { titleFollowedByToken, titleQualifies } from "./titles";

/**
 * Token classes.
 *
 * `HCP` and `STAFF` come from plan §4.1. `PERSON` is for a name found structurally, where
 * by definition nothing is known about whose it is.
 */
export type TokenKind = "HCP" | "STAFF" | "PERSON";

export class PseudonymizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PseudonymizationError";
  }
}

export interface Pseudonymizer {
  /** Replaces names with tokens. Never throws. */
  pseudonymize(text: string): string;
  /** Puts the original text back. Unknown tokens are left alone rather than failing. */
  rehydrate(text: string): string;
  /** Token to the exact original text it replaced. */
  readonly mapping: ReadonlyMap<string, string>;
}

/** Matches any token this module emits. */
const TOKEN_PATTERN = /\[(?:HCP|STAFF|PERSON)_\d+\]/g;

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

/**
 * Every string that should be recognised as this attendee, longest first.
 *
 * The full display name, then the individual name parts. Titles and single initials are
 * dropped: `Dr` is not a name, and a bare `A` would match the indefinite article and every
 * standalone capital in the note. Initials still tokenize when they appear after a title,
 * via the structural pass, which is where they carry a name's weight.
 */
function nameFormsOf(displayName: string): string[] {
  const withoutTitles = displayName
    .split(/\s+/)
    .filter((part) => !titleQualifies(part.replace(/\.$/, "")))
    .join(" ")
    .trim();

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

export function createPseudonymizer(attendees: readonly AttendeeRecord[]): Pseudonymizer {
  const mapping = new Map<string, string>();
  /** Original text to the token already issued for it, so repeats stay stable. */
  const issued = new Map<string, string>();
  const counters: Record<TokenKind, number> = { HCP: 0, STAFF: 0, PERSON: 0 };

  function tokenFor(original: string, kind: TokenKind): string {
    const existing = issued.get(original);
    if (existing) return existing;

    counters[kind] += 1;
    const token = `[${kind}_${counters[kind]}]`;
    issued.set(original, token);
    mapping.set(token, original);
    return token;
  }

  // Longest form first across the whole roster, so "Peter Vance" is consumed before the
  // bare "Vance" can claim half of it. `sort` is stable, so a form shared by two attendees
  // keeps roster order and the class it receives is deterministic.
  const rosterForms = attendees
    .flatMap((attendee) =>
      nameFormsOf(attendee.displayName).map((form) => ({
        form,
        kind: classify(attendee),
      })),
    )
    .sort((a, b) => b.form.length - a.form.length);

  function pseudonymize(text: string): string {
    let output = text;

    // Pass 1 — roster names.
    //
    // A form shared by two attendees is tokenized against the text that was written, not
    // against a guess at which person was meant: both `Vance`s become the same token,
    // which rehydrates to `Vance`. The note is restored exactly as written and the
    // tokenizer never has to decide something it cannot know.
    for (const { form, kind } of rosterForms) {
      const pattern = new RegExp(`\\b${escapeRegExp(form)}\\b(?:['’]s)?`, "gi");
      output = output.replace(pattern, (match) => {
        if (!writtenAsName(match)) return match;
        const { bare, suffix } = splitPossessive(match);
        return tokenFor(bare, kind) + suffix;
      });
    }

    // Pass 2 — a token after a title is a name, known or not.
    //
    // A name already replaced in pass 1 cannot match here: the captured token has to start
    // with a letter, and a token starts with `[`.
    output = output.replace(
      titleFollowedByToken(),
      (match: string, title: string, following: string) => {
        if (!titleQualifies(title)) return match;

        const { bare, suffix } = splitPossessive(following);
        const separator = match.slice(title.length, match.length - following.length);
        return `${title}${separator}${tokenFor(bare, "PERSON")}${suffix}`;
      },
    );

    return output;
  }

  function rehydrate(text: string): string {
    return text.replace(TOKEN_PATTERN, (token) => mapping.get(token) ?? token);
  }

  return { pseudonymize, rehydrate, mapping };
}

/**
 * The guard on the API client. Throws if anything name-shaped survived.
 *
 * This is an invariant, not a user-facing validation. Every path reaching it has already
 * been through `pseudonymize`, so a throw means this module has a defect — exactly when a
 * loud failure is wanted, and exactly when the representative is not the person to tell.
 *
 * It re-derives what a name looks like rather than trusting that a function was called, so
 * removing the tokenizer's structural pass makes this fail. A guard that only checks its
 * own bookkeeping is not a guard.
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
  }

  for (const match of text.matchAll(titleFollowedByToken())) {
    const [, title, following] = match;
    if (!titleQualifies(title)) continue;
    offenders.push(`untokenized name after a title (${following.length} chars)`);
  }

  if (offenders.length > 0) {
    // Lengths, never the text. This message reaches logs and terminals, and echoing the
    // name would put it exactly where this module exists to keep it out of.
    throw new PseudonymizationError(
      `Refusing to send untokenized content to the model: ${offenders.join("; ")}`,
    );
  }
}
