/**
 * The calendar file for the pre-event email: one `VEVENT`, written by hand. Plan §3.3
 * calls it the single highest-conversion element in the email; session 13.
 *
 * BY HAND, NOT A DEPENDENCY. RFC 5545 is stable and small, and the subset here — a
 * calendar, one event, eight properties — is forty lines. A library for it would need an
 * ADR (ADR-0003's rule) that it does not deserve, and would carry recurrence, alarms,
 * time zones, and a parser this application never uses.
 *
 * NO FREE TEXT. `DESCRIPTION` holds the address and the two map links and nothing else.
 * The logistics prose would be claim-bearing text leaving the device without the
 * ruleset — the calendar file is not a draft and passes no gate — so it stays in the
 * email body, where the ruleset runs (ADR-0011). No `ATTENDEE` and no `ORGANIZER`: the
 * application holds no email address for either, and would not put a healthcare
 * professional's address in a file if it did.
 *
 * UTC WITH `Z`, no timezone database: the phone that opens the file converts. `UID` is
 * the event id at `fieldnote.invalid` — `.invalid` is reserved by RFC 2606 and can never
 * resolve — so the identifier is globally unique and points nowhere. CRLF line endings,
 * lines folded at 75 octets with a leading space, text escaped per the RFC (backslash,
 * semicolon, comma, newline). Unit-tested line by line against the fixture event; there
 * is no parser to round-trip through, and that is fine.
 */

import type { EventRecord } from "@/lib/db";
import { formatCoordinates, parseCoordinates } from "@/lib/location/coordinates";
import { appleMapsLink, googleMapsLink } from "@/lib/location/map-links";

export const ICS_PRODID = "-//Fieldnote//Pre-event email//EN";
export const ICS_UID_SUFFIX = "fieldnote.invalid";
export const ICS_MEDIA_TYPE = "text/calendar";
const CRLF = "\r\n";
const FOLD_AT = 75;

/** RFC 5545 §3.3.11: backslash, semicolon, comma, and newline are escaped in text values. */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 §3.1: a content line longer than 75 octets is folded with CRLF and one space. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // The continuation's leading space counts toward its 75.
    const limit = out.length === 0 ? FOLD_AT : FOLD_AT - 1;
    if (octets + size > limit) {
      out.push(current);
      current = char;
      octets = size;
    } else {
      current += char;
      octets += size;
    }
  }
  out.push(current);
  return out.join(`${CRLF} `);
}

/** `YYYYMMDDTHHMMSSZ`, UTC. */
export function formatUtc(timestamp: number): string {
  return new Date(timestamp)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export interface IcsInput {
  event: EventRecord;
  /** When the file was produced; `DTSTAMP`. An input, not a clock read, so the file is testable. */
  stampedAt: number;
}

/** Whether the event can be a calendar entry: it has both ends. */
export function canBuildIcs(event: Pick<EventRecord, "startsAt" | "endsAt">): boolean {
  return event.startsAt !== null && event.endsAt !== null;
}

/** The file, or null when the event has no start or no end. */
export function buildIcs({ event, stampedAt }: IcsInput): string | null {
  if (event.startsAt === null || event.endsAt === null) return null;
  const parsed = event.coordinates.trim() ? parseCoordinates(event.coordinates) : null;
  const address = event.address.trim();
  const description = [
    ...(address ? [address] : []),
    ...(parsed
      ? [`Apple Maps: ${appleMapsLink(parsed)}`, `Google Maps: ${googleMapsLink(parsed)}`]
      : []),
  ].join("\n");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${ICS_PRODID}`,
    "BEGIN:VEVENT",
    `UID:${event.id}@${ICS_UID_SUFFIX}`,
    `DTSTAMP:${formatUtc(stampedAt)}`,
    `DTSTART:${formatUtc(event.startsAt)}`,
    `DTEND:${formatUtc(event.endsAt)}`,
    `SUMMARY:${escapeText(event.name.trim())}`,
    ...(address ? [`LOCATION:${escapeText(address)}`] : []),
    ...(parsed ? [`GEO:${formatCoordinates(parsed).replace(",", ";")}`] : []),
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
