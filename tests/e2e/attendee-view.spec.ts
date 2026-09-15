import { expect, test, type Page } from "@playwright/test";

import { buildPng } from "../../scripts/build-photo-fixture.mjs";

/**
 * The attendee view in a real browser: reached from the switcher's people list, showing
 * one person's record and history, saving an edit, and the rename showing in the dock.
 *
 * All fixture data is synthetic, per ADR-0001.
 */

const SITE = "Northgate demonstration day";
const TYPED = "Vance";
const RENAMED = "Dr. Peter Vance";
const NOTE = "Asked whether the case fits a standard trolley shelf.";

async function startEventWithPerson(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("event-name").fill(SITE);
  await page.getByTestId("create-event").click();
  await expect(page.getByTestId("capture-dock")).toBeVisible();
  await page.getByTestId("note-body").fill(NOTE);
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  await page.getByTestId("toggle-add-attendee").click();
  await page.getByTestId("new-attendee-name").fill(TYPED);
  await page.getByTestId("save-attendee").click();
  await expect(page.getByTestId("note-attendee")).toContainText(TYPED);
}

test.describe("attendee view", () => {
  test("shows the record and the history, saves an edit, and the dock shows the new name", async ({
    page,
  }) => {
    await startEventWithPerson(page);

    // The door: an option in the switcher, beside the other two.
    await page.getByTestId("active-event").selectOption("__people__");
    await expect(page.getByTestId("people-list")).toBeVisible();
    const row = page.getByTestId("person-row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Staff");
    await expect(row).toContainText("added at the event");
    await row.click();

    // The record, and the line saying nothing is fetched.
    await expect(page.getByTestId("attendee-view")).toBeVisible();
    await expect(page.getByTestId("attendee-scope")).toContainText(
      "Nothing is looked up",
    );
    await expect(page.getByTestId("attendee-name")).toHaveValue(TYPED);
    await expect(page.getByTestId("attendee-kind")).toHaveValue("staff");
    await expect(page.getByTestId("attendee-save")).toBeDisabled();

    // The history: the note captured a moment ago, under this event's name.
    await expect(page.getByTestId("attendee-history-summary")).toContainText("1 note");
    await expect(page.getByTestId("history-event")).toContainText(SITE);
    await expect(page.getByTestId("history-note")).toContainText(NOTE);

    // The edit: a class and a role, and a rename.
    await page.getByTestId("attendee-name").fill(RENAMED);
    await page.getByTestId("attendee-kind").selectOption("hcp");
    await page.getByTestId("attendee-role").fill("Consultant");
    await page.getByTestId("attendee-save").click();
    await expect(page.getByTestId("attendee-save-state")).toContainText("Saved");

    // Persisted: a reload finds it, and the dock's select shows the new name.
    await page.reload();
    await expect(page.getByTestId("note-attendee")).toContainText(RENAMED);
    await expect(page.getByTestId("note-attendee")).not.toContainText(`>${TYPED}<`);
    await page.getByTestId("active-event").selectOption("__people__");
    await expect(page.getByTestId("person-row")).toContainText("Clinician · Consultant");

    // Back out to the notes; the dock is as it was.
    await page.getByTestId("people-close").click();
    await expect(page.getByTestId("capture-dock")).toBeVisible();
    await expect(page.getByTestId("note-body")).toHaveValue(NOTE);
  });

  test("resizes a phone-sized photo on the device, stores it as bytes, and keeps the briefing notes", async ({
    page,
  }) => {
    await startEventWithPerson(page);
    const origin = new URL(page.url()).origin;
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    await page.getByTestId("active-event").selectOption("__people__");
    await page.getByTestId("person-row").click();
    await expect(page.getByTestId("attendee-photo-none")).toBeVisible();

    // A twelve-megapixel portrait, built in memory: the shape of a phone photo without
    // a photograph. Session 11's stop condition was that it round-trips IndexedDB.
    await page.getByTestId("attendee-photo-input").setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: buildPng({ width: 3024, height: 4032, initials: "PV" }),
    });
    const photo = page.getByTestId("attendee-photo");
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute("data-width", "384");
    await expect(photo).toHaveAttribute("data-height", "512");

    // Not an image at all: refused with a message, and the stored photo stays.
    await page.getByTestId("attendee-photo-input").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    await expect(page.getByTestId("attendee-photo-error")).toContainText(
      "could not be read",
    );
    await expect(photo).toHaveAttribute("data-width", "384");

    await page
      .getByTestId("attendee-briefing-notes")
      .fill("Open with the trolley question.");
    await expect(page.getByTestId("briefing-notes-state")).toContainText("Saved");

    // Persisted as bytes: a reload finds the thumbnail and the notes.
    await page.reload();
    await page.getByTestId("active-event").selectOption("__people__");
    await page.getByTestId("person-row").click();
    await expect(page.getByTestId("attendee-photo")).toHaveAttribute("data-width", "384");
    await expect(page.getByTestId("attendee-briefing-notes")).toHaveValue(
      "Open with the trolley question.",
    );

    // Nothing left the origin: the photo went to IndexedDB and nowhere else.
    expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);
    expect(requests.filter((url) => new URL(url).pathname.startsWith("/api/"))).toEqual(
      [],
    );

    await page.getByTestId("attendee-photo-remove").click();
    await expect(page.getByTestId("attendee-photo-none")).toBeVisible();
  });
});
