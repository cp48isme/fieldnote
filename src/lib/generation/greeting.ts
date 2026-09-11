/**
 * The greeting line, composed from the attendee record rather than written by the model.
 *
 * Plan §4.1 says the greeting is templated from the name field and the model never
 * needed the name to write the body. Until this module nothing implemented that: the
 * model wrote "Dear [HCP_1]," and rehydration put back ADR-0007's canonical form, which
 * carries no title — so every draft opened "Dear Okonjo-Baptiste," and the representative
 * would have corrected it every time. With edit distance now measured (session 6), the
 * first edit on every draft would have been the same one and the signal would have
 * started polluted. `fieldnote-viw`.
 *
 * WHY THIS IS NOT THE MODEL AUTHORING CONTENT, AND NOT A CLAIM. The next reader will ask,
 * because CLAUDE.md says claim-bearing text is selected, never authored, and that names
 * do not cross the AI boundary. Two answers. The greeting is composed here, on the
 * device, after the model's text has come back and been guarded: the model is told not
 * to write one, and if it does the line is removed before this one is added, so nothing
 * the model wrote reaches the salutation. And an address line carries no product
 * characteristic, indication, or performance statement — it is the recipient's own name
 * as the representative entered it, which is the one string in a draft that could not be
 * a claim about anything. The name never crossed the boundary; it is joined to the draft
 * on the way to the screen, exactly where rehydration already joins every other name.
 *
 * WHAT "THE RECORD HAS A TITLE" MEANS HERE. `AttendeeRecord` has no title field; the
 * title is part of `displayName` as typed — "Dr. Okonjo-Baptiste", "R. Vasquez, theatre
 * coordinator". The greeting uses the display name as entered, because that is the form
 * the representative chose for this person. Session 8's roster import may bring
 * structured fields; the composition takes the record, so it can use them then. The
 * briefing package (`fieldnote-g7d`) will address people too and can call the same
 * function; nothing here assumes an email.
 */

import type { AttendeeRecord } from "@/lib/db";

/** The one form of greeting this build writes. A voice profile (plan §3.3) may vary it. */
const GREETING_PREFIX = "Dear";

/** A subject line, which the composed greeting goes after, not before. */
const SUBJECT_LINE = /^subject:/i;

/**
 * Whether a line reads as a salutation: short, and ending in the comma or colon a
 * greeting ends in. The same heuristic `openingOf` in `pipeline.ts` uses to skip the
 * greeting when taking a draft's opening line, kept in one place so the two agree about
 * what a greeting looks like.
 */
export function isSalutation(line: string): boolean {
  const trimmed = line.trim();
  return /[,:]$/.test(trimmed) && trimmed.split(/\s+/).length <= 8;
}

export function greetingFor(attendee: Pick<AttendeeRecord, "displayName">): string {
  return `${GREETING_PREFIX} ${attendee.displayName.trim()},`;
}

/**
 * The draft with exactly one greeting: the composed one, placed after the subject line
 * if there is one, in place of any salutation the model wrote despite being told not to.
 *
 * The shape the model is asked for is subject, blank line, body. The result is subject,
 * blank line, greeting, blank line, body — the shape the model used to produce with the
 * greeting inside it, so nothing downstream has to know the line moved.
 */
export function composeDraft(modelText: string, greeting: string): string {
  const lines = modelText.split("\n");
  let index = 0;

  // Leading blank lines, then the subject line if the model wrote one.
  while (index < lines.length && lines[index]!.trim() === "") index += 1;
  const head: string[] = [];
  if (index < lines.length && SUBJECT_LINE.test(lines[index]!.trim())) {
    head.push(lines[index]!);
    index += 1;
  }

  // Blank lines after the subject, then a salutation if the model wrote one anyway.
  while (index < lines.length && lines[index]!.trim() === "") index += 1;
  if (index < lines.length && isSalutation(lines[index]!)) {
    index += 1;
    while (index < lines.length && lines[index]!.trim() === "") index += 1;
  }

  const body = lines.slice(index).join("\n");
  return [...head, ...(head.length > 0 ? [""] : []), greeting, "", body].join("\n");
}
