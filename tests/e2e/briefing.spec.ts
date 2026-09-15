import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

/**
 * The briefing in a real browser: reached from the switcher, the dossier and a contact
 * saved and found after a reload, a person opened from it given a photo and returned to
 * it, and Generate producing a PDF download — with every network request recorded so
 * that "nothing is sent" is shown rather than asserted.
 *
 * All fixture data is synthetic, per ADR-0001. The photo is the script-generated one.
 */

const SITE = "Halewood mobile unit, bay 3";
const ATTENDEE = "Dr. Okonjo-Baptiste";
const NOTE = "Asked whether the console can be moved between rooms.";
const OBJECTIVES = "Show the console to the colorectal team and agree a live-case date.";
const CONTINGENCY = "If the lift is out, use the loading bay on the east side.";
const CONTACT_NAME = "Priya Anand";

async function startEventWithPerson(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("event-name").fill(SITE);
  await page.getByTestId("create-event").click();
  await expect(page.getByTestId("capture-dock")).toBeVisible();
  await page.getByTestId("note-body").fill(NOTE);
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  await page.getByTestId("toggle-add-attendee").click();
  await page.getByTestId("new-attendee-name").fill(ATTENDEE);
  await page.getByTestId("save-attendee").click();
  await expect(page.getByTestId("note-attendee")).not.toHaveValue("");
}

test.describe("briefing", () => {
  test("saves the dossier and a contact, takes a photo through the attendee view, and downloads a PDF without a network request", async ({
    page,
  }) => {
    await startEventWithPerson(page);
    const origin = new URL(page.url()).origin;
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    // The door: an option in the switcher.
    await page.getByTestId("active-event").selectOption("__briefing__");
    await expect(page.getByTestId("briefing")).toBeVisible();
    await expect(page.getByTestId("briefing-attendees-note")).toContainText(
      "Expected attendance as of today",
    );

    // 1. The dossier.
    await page.getByTestId("briefing-objectives").fill(OBJECTIVES);
    await page.getByTestId("briefing-contingency").fill(CONTINGENCY);
    await page.getByTestId("briefing-event-save").click();
    await expect(page.getByTestId("briefing-event-state")).toContainText("Saved");

    // 2. A contact, with an address at the one domain the denylist allows.
    await expect(page.getByTestId("briefing-contacts-empty")).toBeVisible();
    await page.getByTestId("briefing-contact-add").click();
    await page.getByTestId("briefing-contact-name").fill(CONTACT_NAME);
    await page.getByTestId("briefing-contact-function").fill("Site coordinator");
    await page.getByTestId("briefing-contact-phone").fill("01234 567890");
    await page.getByTestId("briefing-contact-email").fill("p.anand@example.com");
    await page.getByTestId("briefing-contact-save").click();
    await expect(page.getByTestId("briefing-contact")).toHaveCount(1);
    await expect(page.getByTestId("briefing-contact")).toContainText("Site coordinator");
    await expect(page.getByTestId("briefing-contact")).toContainText(
      "p.anand@example.com",
    );

    // Persisted: a reload finds both.
    await page.reload();
    await page.getByTestId("active-event").selectOption("__briefing__");
    await expect(page.getByTestId("briefing-objectives")).toHaveValue(OBJECTIVES);
    await expect(page.getByTestId("briefing-contact")).toContainText(CONTACT_NAME);

    // 3. The attendee, opened from the briefing, given a photo, and back to the briefing.
    const row = page.getByTestId("briefing-attendee");
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute("data-has-photo", "false");
    await row.click();
    await expect(page.getByTestId("attendee-view")).toBeVisible();
    await page
      .getByTestId("attendee-photo-input")
      .setInputFiles(join(process.cwd(), "tests/fixtures/photo-synthetic.png"));
    await expect(page.getByTestId("attendee-photo")).toHaveAttribute("data-width", "384");
    await page
      .getByTestId("attendee-briefing-notes")
      .fill("Open with the trolley question.");
    await expect(page.getByTestId("briefing-notes-state")).toContainText("Saved");
    await page.getByTestId("attendee-back").click();
    await expect(page.getByTestId("briefing")).toBeVisible();
    await expect(page.getByTestId("briefing-attendee")).toHaveAttribute(
      "data-has-photo",
      "true",
    );
    await expect(page.getByTestId("briefing-attendee")).toContainText("notes written");

    // 4. Generate: a download, a real PDF, and nothing on the wire.
    const downloading = page.waitForEvent("download");
    await page.getByTestId("briefing-generate").click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(
      /^briefing-halewood-mobile-unit-bay-3-\d{4}-\d{2}-\d{2}\.pdf$/,
    );
    const path = await download.path();
    const bytes = readFileSync(path!);
    expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(pdf.getTitle()).toBe(SITE);
    // One embedded image: the photo.
    expect(bytes.toString("latin1").match(/\/Subtype \/Image/g)?.length).toBe(1);

    // No request left the origin, and none went to the API route.
    expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);
    expect(requests.filter((url) => new URL(url).pathname.startsWith("/api/"))).toEqual(
      [],
    );

    // Back to the notes; the dock is as it was.
    await page.getByTestId("briefing-close").click();
    await expect(page.getByTestId("capture-dock")).toBeVisible();
    await expect(page.getByTestId("note-body")).toHaveValue(NOTE);
  });
});
