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
 * THE FORWARDABLE BLOCK (ADR-0002, session 14) is not here. `FORWARDABLE_PLACEHOLDER`
 * is where it will go, and nothing more.
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

/** Session 14 puts ADR-0002's forwardable block here, behind its flag. Nothing today. */
export const FORWARDABLE_PLACEHOLDER = "";

const SIGN_OFF = "Kind regards,";
export const SITE_MAP_LINE = "Site map attached.";
export const LOCATION_HEADING = "Where to find us";

function present(text: string): boolean {
  return text.trim().length > 0;
}

/** The location block: address, coordinates as text, and the two links when they parse. */
export function locationBlock(event: EventRecord, siteMapStored: boolean): string[] {
  const lines: string[] = [];
  if (present(event.address)) lines.push(event.address.trim());
  const parsed = present(event.coordinates) ? parseCoordinates(event.coordinates) : null;
  if (parsed) {
    lines.push(`Coordinates: ${event.coordinates.trim()}`);
    lines.push(`Apple Maps: ${appleMapsLink(parsed)}`);
    lines.push(`Google Maps: ${googleMapsLink(parsed)}`);
  }
  if (siteMapStored) lines.push(SITE_MAP_LINE);
  return lines.length > 0 ? [LOCATION_HEADING, ...lines] : [];
}

/** The body below the greeting, before any rule runs. Exported for the tests and the screen's preview. */
export function composeBody(input: PreEventInput): {
  text: string;
  selected: ApprovedContentRecord[];
} {
  const selected = input.library.filter((p) => input.selectedPassageIds.includes(p.id));
  const sections: string[] = [];
  if (present(input.event.logistics)) sections.push(input.event.logistics.trim());
  const location = locationBlock(input.event, input.siteMapStored);
  if (location.length > 0) sections.push(location.join("\n"));
  for (const passage of selected) sections.push(passage.body);
  if (FORWARDABLE_PLACEHOLDER) sections.push(FORWARDABLE_PLACEHOLDER);
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
