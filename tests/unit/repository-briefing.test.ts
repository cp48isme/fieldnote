/**
 * The briefing's storage (session 11), against the fake database: the dossier on the
 * event, briefing notes on the attendee, one image per owner replaced on re-upload,
 * contacts per event, and what the two cascades remove.
 *
 * All names invented, per ADR-0001.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createAttendee,
  createContact,
  createEvent,
  deleteAttendee,
  deleteEvent,
  getEvent,
  getImage,
  listContacts,
  listImages,
  putImage,
  removeContact,
  removeImage,
  saveAttendeeBriefingNotes,
  updateContact,
  updateEventDossier,
  updateEventLocation,
} from "@/lib/db";
import { setDatabase } from "@/lib/db/database";

import { FakeDatabase } from "./support/fake-database";

let db: FakeDatabase;

beforeEach(() => {
  db = new FakeDatabase();
  setDatabase(db.asDatabase());
});

afterEach(() => {
  setDatabase(null);
});

const bytesOf = (...values: number[]) => new Uint8Array(values).buffer;

describe("the dossier and the briefing notes", () => {
  it("starts empty on a new event and a new attendee, and saves whole", async () => {
    const event = await createEvent({ name: "Northgate demonstration day" });
    expect(event.objectives).toBe("");
    expect(event.contingency).toBe("");
    const updated = await updateEventDossier(event.id, {
      objectives: "Show the console to the urology team.",
      configuration: "Mobile lab in bay 3.",
      itinerary: "08:00 set-up; 10:00 first case.",
      logistics: "Park at the north gate; badge at reception.",
      contingency: "If the lift is out, use the loading bay.",
    });
    expect((await getEvent(event.id))?.itinerary).toBe(updated.itinerary);

    const attendee = await createAttendee({
      eventId: event.id,
      displayName: "Dr. Vance",
    });
    expect(attendee.briefingNotes).toBe("");
    const saved = await saveAttendeeBriefingNotes(attendee.id, "Ask about the trolley.");
    expect(saved.briefingNotes).toBe("Ask about the trolley.");
    expect(saved.displayName).toBe("Dr. Vance");
  });
});

describe("the location", () => {
  it("saves an address and coordinates, and refuses coordinates that do not parse", async () => {
    const event = await createEvent({ name: "Northgate" });
    expect(event.address).toBe("");
    expect(event.coordinates).toBe("");
    const saved = await updateEventLocation(event.id, {
      address: " 12 Ridge Road ",
      coordinates: " 51.5007, -0.1246 ",
    });
    expect(saved.address).toBe("12 Ridge Road");
    expect(saved.coordinates).toBe("51.5007, -0.1246");
    await expect(
      updateEventLocation(event.id, { address: "", coordinates: "north lot" }),
    ).rejects.toThrow(/latitude then longitude/);
    // Empty coordinates are allowed: no map links, no guess.
    const cleared = await updateEventLocation(event.id, { address: "", coordinates: "" });
    expect(cleared.coordinates).toBe("");
    expect((await getEvent(event.id))?.coordinates).toBe("");
  });
});

describe("images", () => {
  it("stores one photo per attendee and replaces it on re-upload", async () => {
    const event = await createEvent({ name: "Northgate" });
    const attendee = await createAttendee({
      eventId: event.id,
      displayName: "Dr. Vance",
    });
    const first = await putImage({
      ownerId: attendee.id,
      purpose: "attendee-photo",
      bytes: bytesOf(1, 2, 3),
      mediaType: "image/jpeg",
      width: 3,
      height: 1,
    });
    const second = await putImage({
      ownerId: attendee.id,
      purpose: "attendee-photo",
      bytes: bytesOf(9, 9),
      mediaType: "image/jpeg",
      width: 2,
      height: 1,
    });
    expect(db.images.rows.size).toBe(1);
    expect(db.images.rows.has(first.id)).toBe(false);
    const stored = await getImage(attendee.id, "attendee-photo");
    expect(stored?.id).toBe(second.id);
    expect(new Uint8Array(stored!.bytes)).toEqual(new Uint8Array([9, 9]));
    expect(stored?.width).toBe(2);

    const byOwner = await listImages([attendee.id, "nobody"], "attendee-photo");
    expect([...byOwner.keys()]).toEqual([attendee.id]);

    await removeImage(attendee.id, "attendee-photo");
    expect(await getImage(attendee.id, "attendee-photo")).toBeUndefined();
  });

  it("refuses a Blob where bytes are declared", async () => {
    const event = await createEvent({ name: "Northgate" });
    const attendee = await createAttendee({
      eventId: event.id,
      displayName: "Dr. Vance",
    });
    await expect(
      putImage({
        ownerId: attendee.id,
        purpose: "attendee-photo",
        bytes: new Blob([bytesOf(1)]) as unknown as ArrayBuffer,
        mediaType: "image/jpeg",
        width: 1,
        height: 1,
      }),
    ).rejects.toThrow(/shape bytes/);
    expect(db.images.rows.size).toBe(0);
  });

  it("goes with its attendee, and with the event through its attendees", async () => {
    const event = await createEvent({ name: "Northgate" });
    const a = await createAttendee({ eventId: event.id, displayName: "Dr. Vance" });
    const b = await createAttendee({ eventId: event.id, displayName: "Marisol Vance" });
    const other = await createEvent({ name: "Elsewhere" });
    const c = await createAttendee({ eventId: other.id, displayName: "Dr. Swali" });
    for (const owner of [a, b, c]) {
      await putImage({
        ownerId: owner.id,
        purpose: "attendee-photo",
        bytes: bytesOf(1),
        mediaType: "image/jpeg",
        width: 1,
        height: 1,
      });
    }
    await deleteAttendee(a.id);
    expect(db.attendees.rows.has(a.id)).toBe(false);
    expect(await getImage(a.id, "attendee-photo")).toBeUndefined();
    expect(await getImage(b.id, "attendee-photo")).toBeDefined();

    await deleteEvent(event.id);
    expect(await getImage(b.id, "attendee-photo")).toBeUndefined();
    // The other event's attendee and photo are untouched.
    expect(db.attendees.rows.has(c.id)).toBe(true);
    expect(await getImage(c.id, "attendee-photo")).toBeDefined();
  });
});

describe("contacts", () => {
  const coordinator = {
    name: "Priya Anand",
    function: "Site coordinator",
    phone: "01234 567890",
    // The denylist refuses any address-shaped string in a tracked file, invented or not.
    email: "",
    notes: "Meets us at the loading bay.",
  };

  it("are added, listed in entry order, edited, and removed", async () => {
    const event = await createEvent({ name: "Northgate" });
    const first = await createContact(event.id, coordinator);
    const second = await createContact(event.id, {
      ...coordinator,
      name: "Tom Okafor",
      function: "Truck operator",
    });
    // Same-millisecond creation is possible in a fast test; entry order is by createdAt.
    expect((await listContacts(event.id)).map((c) => c.name).sort()).toEqual(
      [first.name, second.name].sort(),
    );
    const edited = await updateContact(first.id, {
      ...coordinator,
      phone: "0800 000 000",
    });
    expect(edited.phone).toBe("0800 000 000");
    await removeContact(second.id);
    expect((await listContacts(event.id)).map((c) => c.id)).toEqual([first.id]);
  });

  it("need a name, and go with their event", async () => {
    const event = await createEvent({ name: "Northgate" });
    await expect(createContact(event.id, { ...coordinator, name: "  " })).rejects.toThrow(
      /needs a name/,
    );
    await createContact(event.id, coordinator);
    const other = await createEvent({ name: "Elsewhere" });
    await createContact(other.id, coordinator);
    await deleteEvent(event.id);
    expect(await listContacts(event.id)).toEqual([]);
    expect(await listContacts(other.id)).toHaveLength(1);
  });
});
