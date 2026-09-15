/**
 * The pre-event email, composed from records: plan §3.3, ADR-0011.
 *
 * NO MODEL. Every string here is a record field the representative entered, a passage
 * she selected from the library, a link built from stored coordinates, or a label. That
 * is the whole of what the plan asks for — logistics, the location that actually works,
 * approved product content — and none of it needs writing.
 *
 * A DRAFT ALL THE SAME. It is correspondence to a healthcare professional that leaves
 * the device by the clipboard and carries approved content, so it is a `DraftRecord`
 * under the review gate with an audit record whose model is null (ADR-0011). The caller
 * persists each outcome through `createDraftWithAudit`, as the follow-up pipeline's
 * caller does; nothing is persisted here.
 *
 * THE RULESET RUNS OVER THE WHOLE EMAIL, HERS INCLUDED. Plan §4.2 is about what is
 * claim-bearing, not who wrote it. Her logistics paragraph goes through `applyGuardrails`
 * as model output does — a comparison she types gets the gap marker and she sees it in
 * review — and the product section is passages selected from the library, held out of
 * the rules exactly as session 9's matcher holds them, then put back as the library
 * wrote them. ADR-0002's "unmatched text is blocked, not flagged" is the rule for the
 * whole body.
 *
 * WHAT IS HASHED. Both hashes are over the composed body below the greeting line —
 * `inputHash` before the rules, `outputHash` after — so the record can say what was
 * composed and what was let through. The greeting is outside both, as it is for
 * follow-ups. If she typed a site contact's name into the logistics it is in the
 * pre-image; the record still holds no content.
 *
 * THE FORWARDABLE BLOCK (ADR-0002, session 14) is the email's last section when the
 * event's flag is on, and absent when it is off, which it is until she turns it on for
 * that event. It is self-contained so the recipient can pass it on as it stands: the
 * event's name, when, where, her logistics, and the passages she selected — every one a
 * field the email already carries, with a heading, an opening line, a closing line, and
 * an end marker, all fixed strings exported below. The ADR's five constraints are each a
 * test in `tests/unit/preevent-compose.test.ts`, and they hold by construction: the
 * block has no input of its own, so there is nothing to type into it; it is composed once
 * and is the same for every recipient, so nothing in it can identify who forwarded it;
 * its only links are the two map links, so there is nothing to decorate; and it runs
 * through the ruleset with the rest of the body, so a claim in the logistics is a gap
 * here as it is above. The attachment lines are left out: a site map or a calendar file
 * attached to her email does not travel with a block the recipient forwards.
 */

import type { ApprovedContentRecord, AttendeeRecord, EventRecord, Id } from "@/lib/db";
import {
  libraryVersionOf,
  protectApproved,
  restoreApproved,
  type ApprovedPassage,
} from "@/lib/generation/approved";
import { greetingFor } from "@/lib/generation/greeting";
import { applyGuardrails, GUARDRAIL_RULESET_VERSION } from "@/lib/generation/guardrails";
import { sha256Hex } from "@/lib/generation/hash";
import { parseCoordinates } from "@/lib/location/coordinates";
import { appleMapsLink, googleMapsLink } from "@/lib/location/map-links";

export interface PreEventInput {
  event: EventRecord;
  /** Who gets one. The composer writes one email per record, in this order. */
  recipients: readonly AttendeeRecord[];
  /** The whole library, so a passage found anywhere in the body is held out of the rules. */
  library: readonly ApprovedContentRecord[];
  /** The passages she selected, by id, in library order. */
  selectedPassageIds: readonly Id[];
  /** Whether a site map is stored for the event: the email then says one is attached. */
  siteMapStored: boolean;
  /** Whether a calendar file can be produced — the event has both ends — so the email says one is attached. */
  calendarAttached: boolean;
}

export interface PreEventOutcome {
  attendeeId: Id;
  /** The email as the representative will see it: subject, greeting, guarded body. */
  body: string;
  flagsFired: string[];
  blockedSentences: number;
  guardrailRulesetVersion: string;
  /** Over the composed body below the greeting, before the rules. */
  inputHash: string;
  /** Over the same body after the rules. Equal to `inputHash` when nothing fired. */
  outputHash: string;
  passagesUsed: Id[];
  libraryVersion: string | null;
}

/**
 * The forwardable block's fixed strings (ADR-0002). Everything in the block that is not
 * a record field or a map link is one of these four, and the test asserts it. None names
 * the product, offers anything, or asks for anyone's details.
 */
export const FORWARDABLE_HEADING = "For a colleague who may want to come";
export const FORWARDABLE_OPENING =
  "Everything from here to the closing line can be passed on as it is.";
export const FORWARDABLE_CLOSING =
  "Interested? Ask whoever passed this on to put you in touch.";
export const FORWARDABLE_END = "(End of the part to pass on.)";
export const WHEN_LABEL = "When:";

const SIGN_OFF = "Kind regards,";
export const SITE_MAP_LINE = "Site map attached.";
export const CALENDAR_LINE = "Calendar invitation attached.";
export const LOCATION_HEADING = "Where to find us";

function present(text: string): boolean {
  return text.trim().length > 0;
}

/** The location block: address, coordinates as text, and the two links when they parse. */
export function locationBlock(
  event: EventRecord,
  siteMapStored: boolean,
  calendarAttached = false,
): string[] {
  const lines: string[] = [];
  if (present(event.address)) lines.push(event.address.trim());
  const parsed = present(event.coordinates) ? parseCoordinates(event.coordinates) : null;
  if (parsed) {
    lines.push(`Coordinates: ${event.coordinates.trim()}`);
    lines.push(`Apple Maps: ${appleMapsLink(parsed)}`);
    lines.push(`Google Maps: ${googleMapsLink(parsed)}`);
  }
  if (siteMapStored) lines.push(SITE_MAP_LINE);
  if (calendarAttached) lines.push(CALENDAR_LINE);
  return lines.length > 0 ? [LOCATION_HEADING, ...lines] : [];
}

const longDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const clockTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * The event's times as one line for the block, in the composing device's zone — the
 * block is prose for a person, not a calendar entry, so no UTC and no `Z`. Null with no
 * start. The end's date is repeated only when it differs from the start's.
 */
export function formatWhen(
  startsAt: number | null,
  endsAt: number | null,
): string | null {
  if (startsAt === null) return null;
  const start = `${longDate(startsAt)}, ${clockTime(startsAt)}`;
  if (endsAt === null) return start;
  return longDate(endsAt) === longDate(startsAt)
    ? `${start} to ${clockTime(endsAt)}`
    : `${start} to ${longDate(endsAt)}, ${clockTime(endsAt)}`;
}

/**
 * ADR-0002's block, as lines, for an event whose flag is on. A pure function of the
 * event and the selected passages: no recipient, no attachment lines, no text of its own
 * beyond the four fixed strings. Empty when the flag is off.
 */
export function forwardableBlock(
  event: EventRecord,
  selected: readonly ApprovedContentRecord[],
): string[] {
  if (!event.forwardableEnabled) return [];
  const lines: string[] = [
    FORWARDABLE_HEADING,
    FORWARDABLE_OPENING,
    "",
    event.name.trim(),
  ];
  const when = formatWhen(event.startsAt, event.endsAt);
  if (when) lines.push(`${WHEN_LABEL} ${when}`);
  lines.push(...locationBlock(event, false, false));
  if (present(event.logistics)) lines.push("", event.logistics.trim());
  for (const passage of selected) lines.push("", passage.body);
  lines.push("", FORWARDABLE_CLOSING, FORWARDABLE_END);
  return lines;
}

/** The body below the greeting, before any rule runs. Exported for the tests and the screen's preview. */
export function composeBody(input: PreEventInput): {
  text: string;
  selected: ApprovedContentRecord[];
} {
  const selected = input.library.filter((p) => input.selectedPassageIds.includes(p.id));
  const sections: string[] = [];
  if (present(input.event.logistics)) sections.push(input.event.logistics.trim());
  const location = locationBlock(
    input.event,
    input.siteMapStored,
    input.calendarAttached,
  );
  if (location.length > 0) sections.push(location.join("\n"));
  for (const passage of selected) sections.push(passage.body);
  const forwardable = forwardableBlock(input.event, selected);
  if (forwardable.length > 0) sections.push(forwardable.join("\n"));
  sections.push(SIGN_OFF);
  return { text: sections.join("\n\n"), selected };
}

export async function composePreEvent(input: PreEventInput): Promise<PreEventOutcome[]> {
  const passages: ApprovedPassage[] = input.library.map(({ id, body }) => ({ id, body }));
  const libraryVersion = await libraryVersionOf(passages);
  const { text: composed } = composeBody(input);

  // Compose once, guard once: the body is the same for every recipient; only the
  // greeting differs, and the greeting is outside the rules and the hashes.
  const inputHash = await sha256Hex(composed);
  const held = protectApproved(composed, passages);
  const guarded = applyGuardrails(held.text);
  const guardedText = restoreApproved(guarded.text, held.table);
  const outputHash = await sha256Hex(guardedText);
  const subject = `Subject: Before ${input.event.name.trim()}`;

  return input.recipients.map((attendee) => ({
    attendeeId: attendee.id,
    body: [subject, "", greetingFor(attendee), "", guardedText].join("\n"),
    flagsFired: [...guarded.flagsFired],
    blockedSentences: guarded.blockedSentences,
    guardrailRulesetVersion: GUARDRAIL_RULESET_VERSION,
    inputHash,
    outputHash,
    passagesUsed: [...held.used],
    libraryVersion,
  }));
}
