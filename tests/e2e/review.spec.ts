import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The review gate, end to end, in a real browser with real IndexedDB.
 *
 * The one network call is intercepted at the route and answered with a canned draft, so
 * the suite runs without an API key and without spend, and so that what crossed can be
 * asserted: the intercepted request must carry tokens and no name. What is under test is
 * everything after the model — persistence beside the audit record, the state machine,
 * export to the clipboard, the edit distance, and the CSV — none of which the mock touches.
 *
 * All fixture data is synthetic, per ADR-0001.
 */

const SITE = "Halewood mobile unit, bay 3";
const ATTENDEE = "Dr. Okonjo-Baptiste";
const NOTE = "Asked whether the case fits a standard trolley shelf. Keen on a live case.";

/** What the mocked model writes: one relational line, one claim the ruleset must block. */
function cannedDraft(recipientToken: string): string {
  return [
    "Subject: Thank you for joining us",
    "",
    `Dear ${recipientToken},`,
    "",
    "Thank you for your time on the truck. The system is faster than anything on the market.",
    "",
    "Kind regards,",
  ].join("\n");
}

const GAP = "[approved content required]";

async function answerAsModel(route: Route, blocked: "refusal" | null = null) {
  const request = route.request().postDataJSON() as { recipientToken: string };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      text: blocked ? "" : cannedDraft(request.recipientToken),
      blocked,
      model: "claude-opus-5",
      promptTemplateVersion: "1.0.0",
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

test.describe("review gate", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("a draft persists beside its record, is exported only after being opened, and the audit log carries the edit", async ({
    page,
  }) => {
    const crossed: string[] = [];
    await page.route("**/api/generate", async (route) => {
      crossed.push(route.request().postData() ?? "");
      await answerAsModel(route);
    });

    await startEventWithAttributedNote(page);

    // Into the review view. No drafts yet, and the generate button lives here.
    await page.getByTestId("toggle-view").click();
    await expect(page.getByTestId("follow-ups-empty")).toBeVisible();
    await page.getByTestId("draft-follow-ups").click();

    // Only tokens crossed the boundary.
    await expect(page.getByTestId("draft-row")).toHaveCount(1);
    expect(crossed).toHaveLength(1);
    expect(crossed[0]).not.toContain("Okonjo");
    expect(crossed[0]).toMatch(/\[(HCP|STAFF|PERSON)_\d+\]/);

    // The claim was blocked, the flag is on the row, and nothing on the list can export.
    const row = page.getByTestId("draft-row");
    await expect(row).toHaveAttribute("data-state", "generated");
    await expect(page.getByTestId("draft-row-flags")).toContainText("claim-bearing");
    await expect(page.getByTestId("export-draft")).toHaveCount(0);

    // Persisted: a reload finds it, still unopened.
    await page.reload();
    await expect(page.getByTestId("toggle-view")).toContainText("Follow-ups (1)");
    await page.getByTestId("toggle-view").click();
    await expect(page.getByTestId("draft-row")).toHaveAttribute(
      "data-state",
      "generated",
    );

    // Opening it is the act that marks it reviewed, and only then can it be exported.
    await page.getByTestId("draft-row").click();
    await expect(page.getByTestId("draft-detail")).toHaveAttribute(
      "data-state",
      "reviewed",
    );
    await expect(page.getByTestId("draft-flag")).toHaveAttribute(
      "data-flag",
      "claim-bearing",
    );
    // `toHaveValue`, not `toContainText`: a textarea's text content is not its value. The
    // greeting is the canonical form ADR-0007 rehydrates a draft with — title removed.
    const editor = page.getByTestId("draft-editor");
    await expect(editor).toHaveValue(/\[approved content required\]/);
    await expect(editor).toHaveValue(/Dear Okonjo-Baptiste,/);
    await expect(page.getByTestId("export-draft")).toBeEnabled();

    // Edit: fill the gap the guardrail left.
    const generated = await editor.inputValue();
    const edited = generated.replace(
      GAP,
      "I will send the trolley dimensions on Monday.",
    );
    await editor.fill(edited);
    await expect(page.getByTestId("draft-save-state")).toContainText("Saved");

    // Export copies to the clipboard and records the distance.
    await page.getByTestId("export-draft").click();
    await expect(page.getByTestId("draft-detail")).toHaveAttribute(
      "data-state",
      "exported",
    );
    await expect(page.getByTestId("export-state")).toContainText("nothing is sent");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(edited);
    const distance = Number(
      await page.getByTestId("edit-distance").getAttribute("data-distance"),
    );
    expect(distance).toBeGreaterThan(0);
    await expect(editor).toHaveAttribute("readonly", "");

    // Back on the list, the distance sits beside the flags.
    await page.getByTestId("back-to-drafts").click();
    await expect(page.getByTestId("draft-row")).toHaveAttribute("data-state", "exported");
    await expect(page.getByTestId("draft-row-distance")).toContainText(String(distance));

    // The audit log, as a file: one record, edited, flagged, event present, no content.
    const download = page.waitForEvent("download");
    await page.getByTestId("export-audit-log").click();
    const path = await (await download).path();
    const csv = (await import("node:fs")).readFileSync(path!, "utf8");
    const [header, record, trailing] = csv.split("\r\n");
    expect(header).toMatch(/^recordId,draftId,eventId,eventStatus,/);
    expect(trailing).toBe("");
    const cells = record!.split(",");
    const at = (name: string) => cells[header!.split(",").indexOf(name)];
    expect(at("eventStatus")).toBe("present");
    expect(at("model")).toBe("claude-opus-5");
    expect(at("flagsFired")).toBe("claim-bearing");
    expect(at("humanEdited")).toBe("true");
    expect(at("editDistance")).toBe(String(distance));
    expect(at("inputHash")).toMatch(/^[0-9a-f]{64}$/);
    expect(at("outputHash")).toMatch(/^[0-9a-f]{64}$/);
    expect(csv).not.toContain("Okonjo");
    expect(csv).not.toContain("trolley");
  });

  test("a withheld draft persists with its reason and offers no export", async ({
    page,
  }) => {
    await page.route("**/api/generate", (route) => answerAsModel(route, "refusal"));

    await startEventWithAttributedNote(page);
    await page.getByTestId("toggle-view").click();
    await page.getByTestId("draft-follow-ups").click();

    const row = page.getByTestId("draft-row");
    await expect(row).toHaveAttribute("data-state", "blocked");
    await expect(page.getByTestId("draft-row-state")).toContainText("Withheld");

    await page.reload();
    await page.getByTestId("toggle-view").click();
    await page.getByTestId("draft-row").click();
    await expect(page.getByTestId("draft-detail")).toHaveAttribute(
      "data-state",
      "blocked",
    );
    await expect(page.getByTestId("draft-blocked")).toContainText("declined");
    await expect(page.getByTestId("draft-editor")).toHaveCount(0);
    await expect(page.getByTestId("export-draft")).toHaveCount(0);

    // Its record is in the log, blocked, with an input hash and no output hash.
    await page.getByTestId("back-to-drafts").click();
    const download = page.waitForEvent("download");
    await page.getByTestId("export-audit-log").click();
    const csv = (await import("node:fs")).readFileSync(
      (await (await download).path())!,
      "utf8",
    );
    const [header, record] = csv.split("\r\n");
    const cells = record!.split(",");
    const at = (name: string) => cells[header!.split(",").indexOf(name)];
    expect(at("blocked")).toBe("refusal");
    expect(at("inputHash")).toMatch(/^[0-9a-f]{64}$/);
    expect(at("outputHash")).toBe("");
    expect(at("exportedAt")).toBe("");
  });
});
