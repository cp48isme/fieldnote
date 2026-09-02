import { expect, test, type Page } from "@playwright/test";

/**
 * The capture dock and the log.
 *
 * These cover the behaviours the design rests on rather than its appearance: that a note
 * is not written until something is typed, that the dock and the log agree about which
 * note is open, that a note captured before anyone knew whose it was can be attributed
 * afterwards, and — the one most likely to regress silently — that autosave never moves
 * the caret while someone is correcting a word.
 *
 * All fixture data is synthetic, per ADR-0001. The attendee names are invented, the site
 * is invented, and the notes are about equipment rather than anybody's patients.
 */

const SITE = "Halewood mobile unit, bay 3";

/** A second event, so switching has somewhere to go. Invented, per ADR-0001. */
const SECOND_SITE = "Carrowmore afternoon session";

const FIRST_NOTE = "Wants the demo run again with the taller stand.";
const SECOND_NOTE = "Asked whether the case fits a standard trolley shelf.";

/** Invented, per ADR-0001. Two people, so the attribution select has a real choice. */
const ATTENDEE = "Dr. Okonjo-Baptiste";
const OTHER_ATTENDEE = "R. Vasquez, theatre coordinator";

async function startEvent(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("event-name").fill(SITE);
  await page.getByTestId("create-event").click();
  await expect(page.getByTestId("capture-dock")).toBeVisible();
}

async function capture(page: Page, text: string): Promise<void> {
  await page.getByTestId("note-body").fill(text);
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
}

test.describe("capture dock and log", () => {
  test("writes no note until something is typed", async ({ page }) => {
    await startEvent(page);

    // An event with an open dock and nothing typed has captured nothing. Creating a row
    // on arrival would fill the log with empties from every time the app was opened.
    await expect(page.getByTestId("log-empty")).toBeVisible();
    await expect(page.getByTestId("log-row")).toHaveCount(0);
    await expect(page.getByTestId("new-note")).toBeDisabled();

    await capture(page, FIRST_NOTE);

    await expect(page.getByTestId("log-row")).toHaveCount(1);
    await expect(page.getByTestId("log-row").first()).toContainText(FIRST_NOTE);
  });

  test("starts a second note without disturbing the first", async ({ page }) => {
    await startEvent(page);
    await capture(page, FIRST_NOTE);

    await page.getByTestId("new-note").click();
    await expect(page.getByTestId("note-body")).toHaveValue("");

    await capture(page, SECOND_NOTE);

    // Newest first: the note just written is the one nearest the dock.
    const rows = page.getByTestId("log-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(SECOND_NOTE);
    await expect(rows.nth(1)).toContainText(FIRST_NOTE);
  });

  test("reopens an earlier note from the log", async ({ page }) => {
    await startEvent(page);
    await capture(page, FIRST_NOTE);
    await page.getByTestId("new-note").click();
    await capture(page, SECOND_NOTE);

    await page.getByTestId("log-row").nth(1).click();

    await expect(page.getByTestId("note-body")).toHaveValue(FIRST_NOTE);
    // The log marks which note the dock is holding, so the two surfaces cannot disagree.
    await expect(page.getByTestId("log-row").nth(1)).toHaveAttribute(
      "data-active",
      "true",
    );

    const APPENDED = " Follow up on the stand height.";
    await capture(page, FIRST_NOTE + APPENDED);
    await expect(page.getByTestId("log-row").nth(1)).toContainText(APPENDED.trim());
    await expect(page.getByTestId("log-row")).toHaveCount(2);
  });

  test("attributes a note captured before the name was known", async ({ page }) => {
    await startEvent(page);
    await capture(page, FIRST_NOTE);

    // Captured unattributed, which is the ordinary case in the field.
    await expect(page.getByTestId("log-row").first()).toContainText("Not yet attributed");

    await page.getByTestId("toggle-add-attendee").click();
    await page.getByTestId("new-attendee-name").fill(ATTENDEE);
    await page.getByTestId("save-attendee").click();

    // Adding someone here attributes the open note to them — that is why they were added.
    await expect(page.getByTestId("log-row").first()).toContainText(ATTENDEE);

    await page.reload();
    await expect(page.getByTestId("log-row").first()).toContainText(ATTENDEE);
  });

  test("moves a note to a different person, and back to nobody", async ({ page }) => {
    await startEvent(page);
    await capture(page, FIRST_NOTE);

    for (const name of [ATTENDEE, OTHER_ATTENDEE]) {
      await page.getByTestId("toggle-add-attendee").click();
      await page.getByTestId("new-attendee-name").fill(name);
      await page.getByTestId("save-attendee").click();
    }

    await expect(page.getByTestId("log-row").first()).toContainText(OTHER_ATTENDEE);

    await page.getByTestId("note-attendee").selectOption({ label: ATTENDEE });
    await expect(page.getByTestId("log-row").first()).toContainText(ATTENDEE);

    await page.getByTestId("note-attendee").selectOption({ label: "Not yet attributed" });
    await expect(page.getByTestId("log-row").first()).toContainText("Not yet attributed");
  });

  test("switching events does not carry a note or an attendee across", async ({
    page,
  }) => {
    // Three things have to survive a switch, and none of them is guaranteed by the
    // schema. Keystrokes still inside the debounce belong to the event being left; an
    // in-flight note creation belongs to it too; and an attendee id from event A applied
    // to a note in event B is a cross-event reference the data layer will store happily.
    await startEvent(page);

    await page.getByTestId("toggle-add-attendee").click();
    await page.getByTestId("new-attendee-name").fill(ATTENDEE);
    await page.getByTestId("save-attendee").click();

    // Typed and NOT paused: this is still in the debounce when the switch happens.
    await page.getByTestId("note-body").fill(FIRST_NOTE);
    await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "pending");

    await page.getByTestId("active-event").selectOption({ label: "Start a new event…" });
    await page.getByTestId("event-name").fill(SECOND_SITE);
    await page.getByTestId("create-event").click();
    await expect(page.getByTestId("capture-dock")).toBeVisible();

    // Event B is empty, unattributed, and knows nothing about event A's person.
    await expect(page.getByTestId("note-body")).toHaveValue("");
    await expect(page.getByTestId("note-attendee")).toHaveValue("");
    await expect(page.getByTestId("log-empty")).toBeVisible();
    await expect(page.getByTestId("note-attendee").locator("option")).toHaveCount(1);

    await page.getByTestId("active-event").selectOption({ label: SITE });

    // Event A kept the text that was mid-debounce when the switch happened, and kept it
    // attributed. Nothing was written into B on the way past.
    await expect(page.getByTestId("note-body")).toHaveValue(FIRST_NOTE);
    await expect(page.getByTestId("log-row")).toHaveCount(1);
    await expect(page.getByTestId("log-row").first()).toContainText(ATTENDEE);

    await page.getByTestId("active-event").selectOption({ label: SECOND_SITE });
    await expect(page.getByTestId("log-empty")).toBeVisible();
    await expect(page.getByTestId("note-body")).toHaveValue("");
  });

  test("remembers which event was active across a reload", async ({ page }) => {
    // Without the stored setting, load falls back to the newest event and silently
    // discards the switch — you would reopen the app writing into the wrong one.
    await startEvent(page);
    await capture(page, FIRST_NOTE);

    await page.getByTestId("active-event").selectOption({ label: "Start a new event…" });
    await page.getByTestId("event-name").fill(SECOND_SITE);
    await page.getByTestId("create-event").click();
    await capture(page, SECOND_NOTE);

    // Switch back to the older event, which is not the one load would guess.
    await page.getByTestId("active-event").selectOption({ label: SITE });
    await expect(page.getByTestId("note-body")).toHaveValue(FIRST_NOTE);

    await page.reload();

    await expect(page.getByTestId("event-name-display")).toHaveText(SITE);
    await expect(page.getByTestId("note-body")).toHaveValue(FIRST_NOTE);
  });

  test("leaves the caret alone while autosave runs", async ({ page }) => {
    // The dictation case, and the reason this test exists. Corrections happen in the
    // middle of a word, and an autosave that wrote the persisted string back into the
    // textarea would jump the caret to the end mid-fix. Every keystroke after that lands
    // in the wrong place, and it happens exactly when someone is standing in a car park
    // trying to repair a mangled surname.
    await startEvent(page);

    const MANGLED = "Asked about the too units on the second shelf.";
    await capture(page, MANGLED);

    // Put the caret inside "too" and correct it to "two", then wait out a full save.
    const caret = MANGLED.indexOf("too") + "too".length;
    await page.getByTestId("note-body").click();
    await page.getByTestId("note-body").evaluate((node, position) => {
      const textarea = node as HTMLTextAreaElement;
      textarea.setSelectionRange(position, position);
    }, caret);

    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("wo");
    await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

    await expect(page.getByTestId("note-body")).toHaveValue(
      "Asked about the two units on the second shelf.",
    );

    // The caret is still where the correction left it, not at the end of the note, and
    // the textarea still has focus — the software keyboard has not been dismissed.
    const selection = await page.getByTestId("note-body").evaluate((node) => {
      const textarea = node as HTMLTextAreaElement;
      return {
        start: textarea.selectionStart,
        focused: document.activeElement === textarea,
      };
    });
    expect(selection.start).toBe(caret);
    expect(selection.focused).toBe(true);

    // Typing continues where the caret is, not at the end.
    await page.keyboard.type("!");
    await expect(page.getByTestId("note-body")).toHaveValue(
      "Asked about the two! units on the second shelf.",
    );
  });
});
