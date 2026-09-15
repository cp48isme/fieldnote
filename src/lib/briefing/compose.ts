/**
 * The briefing as a document model: what goes on the page, in what order, from which
 * records. Plan §3.2 as amended by ADR-0009.
 *
 * A pure function over records, separate from the drawing (`render.ts`), so what the
 * document says can be tested as text without opening a PDF. The model writes none of
 * it: every string here is a record field the representative entered, a label, or the
 * page's own statement of its limits.
 *
 * WHAT IS IN IT. The dossier — the five event fields she filled, empty ones omitted;
 * contacts as cards; attendees one per block with the photo, the record's fields, and
 * her briefing notes; the contingency plan last. No talking-points section: those are
 * in the attendee blocks, written by her. No deal positioning, no field for it.
 *
 * WHAT IS NOT IN IT. The dictated notes. They were captured for follow-ups; a document
 * that gets forwarded and printed does not carry them, and `BriefingInput` has no place
 * to put them — `tests/unit/briefing-compose.test.ts` asserts the type has no such key.
 *
 * THE PAGE STATES ITS OWN LIMITS. The attendee section is expected attendance as of the
 * generation date (`fieldnote-g7d`): the roster is an intention, not a record, and
 * people met at the event who were never listed will not appear. The footer on every
 * page says so, with the event name and the generation time.
 */

import type { AttendeeRecord, ContactRecord, EventRecord, ImageRecord } from "@/lib/db";

export interface BriefingAttendee {
  attendee: AttendeeRecord;
  photo: ImageRecord | null;
}

export interface BriefingInput {
  event: EventRecord;
  contacts: readonly ContactRecord[];
  attendees: readonly BriefingAttendee[];
  /** Epoch milliseconds; the document carries it, so it is an input, not a clock read. */
  generatedAt: number;
}

export interface BriefingImage {
  bytes: ArrayBuffer;
  mediaType: string;
  width: number;
  height: number;
}

export type BriefingBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "field"; label: string; text: string }
  | {
      kind: "card";
      title: string;
      lines: readonly string[];
      image: BriefingImage | null;
    };

export interface BriefingSection {
  heading: string;
  blocks: readonly BriefingBlock[];
}

export interface BriefingFooter {
  /** The event and when the document was generated. */
  event: string;
  /** The expected-attendance statement, whole, on its own line. */
  attendance: string;
}

export interface BriefingDocument {
  title: string;
  subtitle: string;
  /** Drawn on every page. */
  footer: BriefingFooter;
  sections: readonly BriefingSection[];
}

const NOTHING_ENTERED = "Nothing entered.";

export function formatBriefingDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatBriefingDateTime(timestamp: number): string {
  return `${formatBriefingDate(timestamp)}, ${new Date(timestamp).toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  )}`;
}

/** The dossier fields in page order, with the label each carries. */
const DOSSIER: ReadonlyArray<[keyof EventRecord & string, string]> = [
  ["objectives", "Objectives"],
  ["configuration", "Configuration"],
  ["itinerary", "Itinerary"],
  ["logistics", "Logistics"],
];

function present(text: string): boolean {
  return text.trim().length > 0;
}

export function expectedAttendanceLine(generatedAt: number): string {
  return `Attendee list is expected attendance as of ${formatBriefingDate(generatedAt)}.`;
}

export function composeBriefing(input: BriefingInput): BriefingDocument {
  const { event, generatedAt } = input;

  const eventBlocks: BriefingBlock[] = [];
  if (event.startsAt !== null) {
    eventBlocks.push({
      kind: "field",
      label: "Date",
      text: formatBriefingDate(event.startsAt),
    });
  }
  if (present(event.siteLabel)) {
    eventBlocks.push({ kind: "field", label: "Site", text: event.siteLabel.trim() });
  }
  for (const [key, label] of DOSSIER) {
    const text = String(event[key]);
    if (present(text)) eventBlocks.push({ kind: "field", label, text: text.trim() });
  }
  if (eventBlocks.length === 0)
    eventBlocks.push({ kind: "paragraph", text: NOTHING_ENTERED });

  const contactBlocks: BriefingBlock[] = input.contacts.map((contact) => ({
    kind: "card",
    title: contact.name,
    lines: [contact.function, contact.phone, contact.email, contact.notes].filter(
      present,
    ),
    image: null,
  }));
  if (contactBlocks.length === 0) {
    contactBlocks.push({ kind: "paragraph", text: NOTHING_ENTERED });
  }

  const attendeeBlocks: BriefingBlock[] = [
    {
      kind: "paragraph",
      text: `${expectedAttendanceLine(generatedAt)} People met at the event who are not on this list will not appear here.`,
    },
    ...[...input.attendees]
      .sort((a, b) => a.attendee.displayName.localeCompare(b.attendee.displayName))
      .map(({ attendee, photo }): BriefingBlock => {
        const details = [attendee.role, attendee.specialty, attendee.institution].filter(
          present,
        );
        const lines = [
          ...(details.length > 0 ? [details.join(" · ")] : []),
          ...(present(attendee.briefingNotes) ? [attendee.briefingNotes.trim()] : []),
        ];
        return {
          kind: "card",
          title: attendee.displayName,
          lines,
          image: photo
            ? {
                bytes: photo.bytes,
                mediaType: photo.mediaType,
                width: photo.width,
                height: photo.height,
              }
            : null,
        };
      }),
  ];
  if (input.attendees.length === 0) {
    attendeeBlocks.push({ kind: "paragraph", text: "Nobody is listed yet." });
  }

  const contingencyBlocks: BriefingBlock[] = [
    {
      kind: "paragraph",
      text: present(event.contingency) ? event.contingency.trim() : NOTHING_ENTERED,
    },
  ];

  return {
    title: event.name,
    subtitle: `Internal briefing · generated ${formatBriefingDateTime(generatedAt)}`,
    footer: {
      event: `${event.name} · Generated ${formatBriefingDateTime(generatedAt)}`,
      attendance: expectedAttendanceLine(generatedAt),
    },
    sections: [
      { heading: "Event", blocks: eventBlocks },
      { heading: "Contacts", blocks: contactBlocks },
      { heading: "Attendees", blocks: attendeeBlocks },
      { heading: "Contingency plan", blocks: contingencyBlocks },
    ],
  };
}
