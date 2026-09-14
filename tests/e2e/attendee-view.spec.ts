import { expect, test, type Page } from "@playwright/test";

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
});
