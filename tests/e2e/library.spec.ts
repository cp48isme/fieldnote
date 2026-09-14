import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The approved content library in a real browser: reached from the switcher, a passage
 * added, one refused at load with the rule named, one edited, one removed with the note
 * that audit records keep it; and then a draft that copies a passage exactly, with the
 * detail view saying so.
 *
 * The model call is intercepted at the route and answered with the passage the request
 * carried, so what is under test is the client's half: the library travelling with the
 * request, the matcher finding the copy, and the audit record carrying the id.
 *
 * All fixture data is synthetic, per ADR-0001. Every passage is invented.
 */

const SITE = "Halewood mobile unit, bay 3";
const ATTENDEE = "Dr. Okonjo-Baptiste";
const NOTE = "Asked whether the console can be moved between rooms.";

const PASSAGE = {
  label: "Console overview",
  body: "The open control console sits at eye level and is designed to move between rooms on its own stand.",
  sourceRef: "SYN-DOC-0001 v1",
};
const EDITED_LABEL = "Console, overview";
const REFUSED_BODY = "We would be glad to host dinner after the demonstration.";

/** The model copies the one passage it was given, exactly, and writes nothing else about the product. */
async function answerWithPassage(route: Route) {
  const request = route.request().postDataJSON() as {
    recipientToken: string;
    passages: Array<{ id: string; body: string }>;
  };
  const passage = request.passages[0]?.body ?? "";
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      text: [
        "Subject: Thank you for joining us",
        "",
        `Dear ${request.recipientToken},`,
        "",
        "Thank you for your time on the truck.",
        "",
        passage,
        "",
        "Kind regards,",
      ].join("\n"),
      blocked: null,
      model: "claude-opus-5",
      promptTemplateVersion: "1.2.0",
      flagsFired: [],
    }),
  });
}

async function startEventWithAttributedNote(page: Page): Promise<void> {
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

test.describe("approved content library", () => {
  test("adds, refuses, edits, and removes passages, and a draft that copies one says so", async ({
    page,
  }) => {
    const crossed: Array<{ passages: Array<{ id: string; body: string }> }> = [];
    await page.route("**/api/generate", async (route) => {
      crossed.push(route.request().postDataJSON());
      await answerWithPassage(route);
    });

    await startEventWithAttributedNote(page);

    // The door: an option in the switcher. The library starts empty.
    await page.getByTestId("active-event").selectOption("__library__");
    await expect(page.getByTestId("library")).toBeVisible();
    await expect(page.getByTestId("library-empty")).toBeVisible();

    // A passage that mentions a meal is refused at load, with the rule named.
    await page.getByTestId("library-add").click();
    await page.getByTestId("library-label").fill("Hospitality");
    await page.getByTestId("library-body").fill(REFUSED_BODY);
    await page.getByTestId("library-save").click();
    await expect(page.getByTestId("library-error")).toContainText("hospitality");
    await expect(page.getByTestId("library-row")).toHaveCount(0);

    // The passage itself loads.
    await page.getByTestId("library-label").fill(PASSAGE.label);
    await page.getByTestId("library-body").fill(PASSAGE.body);
    await page.getByTestId("library-source").fill(PASSAGE.sourceRef);
    await page.getByTestId("library-save").click();
    const row = page.getByTestId("library-row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(PASSAGE.label);
    await expect(row).toContainText(PASSAGE.sourceRef);

    // Persisted: a reload finds it.
    await page.reload();
    await page.getByTestId("active-event").selectOption("__library__");
    await expect(page.getByTestId("library-row")).toHaveCount(1);

    // Edit the label; the body is untouched.
    await page.getByTestId("library-edit").click();
    await expect(page.getByTestId("library-body")).toHaveValue(PASSAGE.body);
    await page.getByTestId("library-label").fill(EDITED_LABEL);
    await page.getByTestId("library-save").click();
    await expect(page.getByTestId("library-row")).toContainText(EDITED_LABEL);

    // Back to the notes, then draft. The library travels with the request.
    await page.getByTestId("library-close").click();
    await expect(page.getByTestId("capture-dock")).toBeVisible();
    await page.getByTestId("toggle-view").click();
    await page.getByTestId("draft-follow-ups").click();
    await expect(page.getByTestId("draft-row")).toHaveCount(1);
    expect(crossed).toHaveLength(1);
    expect(crossed[0]!.passages).toHaveLength(1);
    expect(crossed[0]!.passages[0]!.body).toBe(PASSAGE.body);

    // The copy was exact, so it passed as approved: no flag, no gap, and the detail
    // view says one passage was used.
    await expect(page.getByTestId("draft-row-flags")).toHaveCount(0);
    await page.getByTestId("draft-row").click();
    await expect(page.getByTestId("draft-detail")).toBeVisible();
    await expect(page.getByTestId("draft-editor")).toHaveValue(
      new RegExp(PASSAGE.body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    await expect(page.getByTestId("draft-editor")).not.toHaveValue(
      /\[approved content required\]/,
    );
    await expect(page.getByTestId("passages-used")).toHaveAttribute("data-count", "1");
    await expect(page.getByTestId("passages-used")).toContainText(
      "1 approved passage used",
    );

    // Remove the passage. The screen says the audit record keeps its reference, and
    // the draft's detail still counts it.
    await page.getByTestId("back-to-drafts").click();
    await page.getByTestId("active-event").selectOption("__library__");
    await expect(page.getByTestId("library")).toContainText(
      "keeps its reference in the audit record",
    );
    await page.getByTestId("library-remove").click();
    await expect(page.getByTestId("library-row")).toHaveCount(0);
    await expect(page.getByTestId("library-empty")).toBeVisible();
    // The follow-ups view is where the library was opened from, so it is where closing
    // the library returns.
    await page.getByTestId("library-close").click();
    await expect(page.getByTestId("follow-ups")).toBeVisible();
    await page.getByTestId("draft-row").click();
    await expect(page.getByTestId("passages-used")).toHaveAttribute("data-count", "1");
  });
});
