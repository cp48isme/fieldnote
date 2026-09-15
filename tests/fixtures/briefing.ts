/**
 * A synthetic event, its contacts, and its attendees, for the briefing tests. Every
 * name, place, number, and sentence is invented, per ADR-0001. Contact emails are at
 * `example.com`, the one domain the denylist allows: RFC 2606 reserves it, so an address
 * there belongs to nobody.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ContactRecord, EventRecord, ImageRecord } from "@/lib/db";

import { ROSTER } from "./dictation";

const AT = Date.UTC(2026, 8, 14, 9, 30);

export const BRIEFING_EVENT: EventRecord = {
  id: "event-briefing",
  createdAt: AT,
  updatedAt: AT,
  schemaVersion: 6,
  name: "Northgate demonstration day",
  siteLabel: "Northgate Regional, mobile lab in bay 3",
  startsAt: Date.UTC(2026, 9, 2, 8, 0),
  endsAt: Date.UTC(2026, 9, 2, 16, 0),
  status: "planned",
  objectives:
    "Show the console to the colorectal and upper GI teams; agree a live-case date.",
  configuration:
    "Mobile lab with one console and the sensor module on the demonstration stand.",
  itinerary:
    "08:00 set-up · 09:30 first group · 12:00 break · 13:00 second group · 15:30 pack down",
  logistics:
    "Park at the north gate. Badges at reception; ask for the theatre coordinator.",
  contingency:
    "If the lift is out of service, use the loading bay on the east side and allow twenty minutes.",
  address: "Northgate Regional Hospital, 12 Ridge Road",
  coordinates: "51.5007, -0.1246",
};

function contact(
  id: string,
  name: string,
  fn: string,
  phone: string,
  notes: string,
  email = "",
): ContactRecord {
  return {
    id,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: 6,
    eventId: BRIEFING_EVENT.id,
    name,
    function: fn,
    phone,
    email,
    notes,
  };
}

export const BRIEFING_CONTACTS: readonly ContactRecord[] = [
  contact(
    "con-1",
    "Priya Anand",
    "Site coordinator",
    "01234 567890",
    "Meets us at the loading bay.",
    "p.anand@example.com",
  ),
  contact("con-2", "Tom Okafor", "Truck operator", "01234 567891", ""),
  contact(
    "con-3",
    "Lena Marsh",
    "Territory manager",
    "01234 567892",
    "Joins for the second group.",
  ),
];

/** The committed synthetic photo, as the store would hold it. */
export function fixturePhoto(ownerId: string): ImageRecord {
  const png = readFileSync(join(process.cwd(), "tests/fixtures/photo-synthetic.png"));
  return {
    id: `img-${ownerId}`,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: 6,
    ownerId,
    purpose: "attendee-photo",
    bytes: new Uint8Array(png).buffer,
    mediaType: "image/png",
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

export const BRIEFING_ATTENDEES = ROSTER.map((attendee, index) => ({
  attendee: {
    ...attendee,
    eventId: BRIEFING_EVENT.id,
    schemaVersion: 6,
    briefingNotes:
      index === 1
        ? "Open with the trolley question — he raised it twice last time. Keep to the approved wording on the console."
        : "",
  },
  photo: index === 1 ? fixturePhoto(attendee.id) : null,
}));

export const GENERATED_AT = Date.UTC(2026, 8, 15, 7, 45);
