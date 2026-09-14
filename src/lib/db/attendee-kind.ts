/**
 * The one rule that decides `Attendee.kind` from text: a leading title of Dr or Prof
 * means a clinician. Used by roster import on the mapped title column (session 8) and,
 * since session 9, by the dock's add-person path on the display name the
 * representative typed — she writes "Dr. Swali", and the record should say `hcp`
 * without a toggle (`fieldnote-frx`). The attendee view corrects either.
 *
 * A title column or a leading title is the one thing that says "clinician" without
 * saying anything else; a department or a role does not (`fieldnote-1o6`), which is why
 * neither is read here. The words are the pseudonymizer's own title list's clinician
 * subset, kept in step by the test.
 */

import type { AttendeeKind } from "./schema";

const CLINICIAN_TITLE = /^(?:dr|prof|professor|doctor)\.?$/i;

export function kindFromTitle(title: string): AttendeeKind {
  return CLINICIAN_TITLE.test(title.trim()) ? "hcp" : "staff";
}

/** The display name's first word, if it is a title. "Dr. Swali" → hcp; "Marisol Vance" → staff. */
export function kindFromDisplayName(displayName: string): AttendeeKind {
  const first = displayName.trim().split(/\s+/)[0] ?? "";
  return kindFromTitle(first);
}
