/**
 * The matcher: proposes which imported rows are people already on the event, and
 * nothing more. The representative confirms; `applyRosterImport` applies only what was
 * confirmed and has no matcher of its own.
 *
 * WHAT IT COMPARES. Canonical names — `canonicalNameOf` from the pseudonymizer, titles
 * stripped — so "Dr. Okonjo-Baptiste" and "Dr Okonjo-Baptiste" are one name and a
 * title decides nothing. Three bases, tried in order, each more conservative than a
 * fuzzy score would be:
 *
 *   1. `exact` — the whole canonical name, case-insensitive.
 *   2. `surname` — the last word of each canonical name, case-insensitive: the sheet
 *      has "Vance" and the dock has "Marisol Vance".
 *   3. `close` — edit distance of one on surnames of five letters or more: a dropped
 *      or doubled letter. Shorter surnames are not tried, because one edit on a
 *      four-letter name is a different name.
 *
 * WHAT IT MISSES, BY DESIGN. The observed dictation mangling — spoken "Swali",
 * transcribed "Swelha" — is three edits on a five-letter surname and is not proposed.
 * ADR-0006 records why no threshold that catches it can avoid firing on ordinary prose,
 * and that reasoning holds here: a matcher that proposed Swelha for Swali would propose
 * Green for Greene and Vance for Lance too, and a wrong proposal confirmed with a tap is
 * a merged record with a stranger's role in it. The representative adding the person
 * again, or spotting the pair in the review list, is the control.
 *
 * Each existing attendee is proposed for at most one row, in row order, so two sheet
 * rows cannot both claim the same person; the second gets no proposal and is reviewed
 * as new.
 */

import type { AttendeeRecord } from "@/lib/db";
import { canonicalNameOf } from "@/lib/privacy/pseudonymize";
import { editDistance } from "@/lib/review/edit-distance";

import type { ImportedPerson } from "./header";

export type MatchBasis = "exact" | "surname" | "close";

export interface MatchProposal {
  person: ImportedPerson;
  /** The existing attendee this row may be, or null when nothing was close enough. */
  candidate: AttendeeRecord | null;
  basis: MatchBasis | null;
}

/** Surnames this short are not compared by distance: one edit is another name. */
const MIN_CLOSE_LENGTH = 5;
const MAX_CLOSE_DISTANCE = 1;

const fold = (name: string) => canonicalNameOf(name).toLowerCase();
const surnameOf = (canonical: string) =>
  canonical.split(" ").filter(Boolean).at(-1) ?? "";

function basisFor(person: string, existing: string): MatchBasis | null {
  const a = fold(person);
  const b = fold(existing);
  if (a.length === 0 || b.length === 0) return null;
  if (a === b) return "exact";
  const sa = surnameOf(a);
  const sb = surnameOf(b);
  if (sa === sb) return "surname";
  if (
    sa.length >= MIN_CLOSE_LENGTH &&
    sb.length >= MIN_CLOSE_LENGTH &&
    editDistance(sa, sb) <= MAX_CLOSE_DISTANCE
  ) {
    return "close";
  }
  return null;
}

const RANK: Record<MatchBasis, number> = { exact: 0, surname: 1, close: 2 };

export function proposeMatches(
  people: readonly ImportedPerson[],
  existing: readonly AttendeeRecord[],
): MatchProposal[] {
  const claimed = new Set<string>();
  return people.map((person) => {
    let best: { candidate: AttendeeRecord; basis: MatchBasis } | null = null;
    for (const attendee of existing) {
      if (claimed.has(attendee.id)) continue;
      const basis = basisFor(person.displayName, attendee.displayName);
      if (basis === null) continue;
      if (best === null || RANK[basis] < RANK[best.basis]) {
        best = { candidate: attendee, basis };
      }
    }
    if (best === null) return { person, candidate: null, basis: null };
    claimed.add(best.candidate.id);
    return { person, candidate: best.candidate, basis: best.basis };
  });
}
