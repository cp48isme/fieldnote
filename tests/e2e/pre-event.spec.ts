import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { buildPng } from "../../scripts/build-photo-fixture.mjs";

/**
 * The pre-event email in a real browser: the location saved with its coordinates
 * validated, a phone-sized site map resized to 1600 PNG and stored, downloaded, and
 * drawn into the briefing; the start and end saved and the calendar file downloaded
 * (session 13); a passage selected from the library; a comparison typed into
 * the logistics; and Compose writing a draft that lands in the review surface as a
 * pre-event email, opens with the gap and the passage, exports to the clipboard, and
 * appears in the audit CSV with an empty model cell. Every request is recorded: the
 * model route is never called.
 *
 * All fixture data is synthetic, per ADR-0001.
 */

const SITE = "Halewood mobile unit, bay 3";
const ATTENDEE = "Dr. Okonjo-Baptiste";
const NOTE = "Asked whether the console can be moved between rooms.";
const ADDRESS = "Halewood Regional Hospital, 4 Mill Lane";
const COORDINATES = "53.3547, -2.8351";
const LOGISTICS =
  "Please arrive between 08:30 and 09:00; the session runs about ninety minutes. Our console is faster than anything you have used before.";
const PASSAGE = {
  label: "Console overview",
  body: "The open control console sits at eye level and is designed to move between rooms on its own stand.",
  sourceRef: "SYN-DOC-0001 v1",
};
const GAP = "[approved content required]";

/** Every regex metacharacter, backslash included, so a literal can be matched as itself. */
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

test.describe("pre-event email", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("composes a guarded draft per recipient from the location, the logistics, and a passage, with no model call", async ({
    page,
  }) => {
    await startEventWithPerson(page);
    const origin = new URL(page.url()).origin;
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    // A passage in the library first.
    await page.getByTestId("active-event").selectOption("__library__");
    await page.getByTestId("library-add").click();
    await page.getByTestId("library-label").fill(PASSAGE.label);
    await page.getByTestId("library-body").fill(PASSAGE.body);
    await page.getByTestId("library-source").fill(PASSAGE.sourceRef);
    await page.getByTestId("library-save").click();
    await expect(page.getByTestId("library-row")).toHaveCount(1);
    await page.getByTestId("library-close").click();

    // The door.
    await page.getByTestId("active-event").selectOption("__preevent__");
    await expect(page.getByTestId("pre-event")).toBeVisible();

    // 1. Location: a bad pair is refused on entry; a good one yields both links.
    await page.getByTestId("pre-event-address").fill(ADDRESS);
    await page.getByTestId("pre-event-coordinates").fill("north lot");
    await page.getByTestId("pre-event-location-save").click();
    await expect(page.getByTestId("pre-event-location-state")).toContainText(
      "latitude then longitude",
    );
    await page.getByTestId("pre-event-coordinates").fill(COORDINATES);
    await expect(page.getByTestId("pre-event-apple-link")).toContainText(
      "https://maps.apple.com/?ll=53.354700,-2.835100",
    );
    await expect(page.getByTestId("pre-event-google-link")).toContainText(
      "query=53.354700,-2.835100",
    );
    await page.getByTestId("pre-event-location-save").click();
    await expect(page.getByTestId("pre-event-location-state")).toContainText("Saved");

    // The site map: a twelve-megapixel portrait, resized to 1600 on its longest edge as
    // PNG, stored, and downloadable as a file. Session 12's stop condition.
    await page.getByTestId("pre-event-site-map-input").setInputFiles({
      name: "site-map.png",
      mimeType: "image/png",
      buffer: buildPng({ width: 3024, height: 4032, initials: "NL" }),
    });
    const map = page.getByTestId("pre-event-site-map");
    await expect(map).toBeVisible();
    await expect(map).toHaveAttribute("data-width", "1200");
    await expect(map).toHaveAttribute("data-height", "1600");
    await expect(map).toHaveAttribute("data-media-type", "image/png");
    const downloading = page.waitForEvent("download");
    await page.getByTestId("pre-event-site-map-download").click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe("site-map-halewood-mobile-unit-bay-3.png");
    const mapBytes = readFileSync((await download.path())!);
    expect([...mapBytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);

    // The times: the calendar file is disabled until both are saved, then downloads
    // as text/calendar with both ends and no free text.
    await expect(page.getByTestId("pre-event-calendar-download")).toBeDisabled();
    await expect(page.getByTestId("pre-event-calendar-state")).toContainText(
      "Needs a saved start",
    );
    await page.getByTestId("pre-event-starts").fill("2026-10-02T08:00");
    await page.getByTestId("pre-event-ends").fill("2026-10-02T07:00");
    await page.getByTestId("pre-event-times-save").click();
    await expect(page.getByTestId("pre-event-times-state")).toContainText(
      "end after it starts",
    );
    await page.getByTestId("pre-event-ends").fill("2026-10-02T16:00");
    await page.getByTestId("pre-event-times-save").click();
    await expect(page.getByTestId("pre-event-times-state")).toContainText("Saved");
    await expect(page.getByTestId("pre-event-calendar-download")).toBeEnabled();
    const icsDownloading = page.waitForEvent("download");
    await page.getByTestId("pre-event-calendar-download").click();
    const icsDownload = await icsDownloading;
    expect(icsDownload.suggestedFilename()).toBe("event-halewood-mobile-unit-bay-3.ics");
    const ics = readFileSync((await icsDownload.path())!, "utf8");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toMatch(/\r\nDTSTART:\d{8}T\d{6}Z\r\nDTEND:\d{8}T\d{6}Z\r\n/);
    expect(ics).toContain("SUMMARY:Halewood mobile unit\\, bay 3\r\n");
    expect(ics).toContain("GEO:53.354700;-2.835100\r\n");
    expect(ics).not.toMatch(/ATTENDEE|ORGANIZER|Please arrive/);

    // 2. Logistics, with a comparison in it.
    await page.getByTestId("pre-event-logistics-text").fill(LOGISTICS);
    await page.getByTestId("pre-event-logistics-save").click();
    await expect(page.getByTestId("pre-event-logistics-state")).toContainText("Saved");

    // 3. The passage, ticked. 4. The recipient is selected already. 5. Compose.
    await page.getByTestId("pre-event-passage").check();
    await expect(page.getByTestId("pre-event-recipient")).toBeChecked();
    await expect(page.getByTestId("pre-event-compose")).toContainText("Compose 1 draft");
    await page.getByTestId("pre-event-compose").click();

    // In the review surface as a pre-event email, not yet opened.
    await expect(page.getByTestId("follow-ups")).toBeVisible();
    await expect(page.getByTestId("follow-ups-notice")).toContainText(
      "1 pre-event email composed",
    );
    const row = page.getByTestId("draft-row");
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute("data-kind", "pre-event");
    await expect(row).toHaveAttribute("data-state", "generated");
    await expect(page.getByTestId("draft-row-kind")).toContainText("Pre-event email");
    await expect(page.getByTestId("draft-row-flags")).toContainText("claim-bearing");

    // Opened: the comparison is a gap, the passage is exact, the map is announced, the
    // links are text, and the copy names no model.
    await row.click();
    await expect(page.getByTestId("draft-detail")).toHaveAttribute(
      "data-kind",
      "pre-event",
    );
    await expect(page.getByTestId("draft-kind-note")).toContainText(
      "No model wrote any of it",
    );
    const editor = page.getByTestId("draft-editor");
    await expect(editor).toHaveValue(/Dear Dr\. Okonjo-Baptiste,/);
    await expect(editor).toHaveValue(/Please arrive between 08:30 and 09:00/);
    await expect(editor).not.toHaveValue(/faster than anything/);
    await expect(editor).toHaveValue(new RegExp(escapeRegExp(GAP)));
    await expect(editor).toHaveValue(/Site map attached\./);
    await expect(editor).toHaveValue(/Calendar invitation attached\./);
    await expect(editor).toHaveValue(/Apple Maps: https:\/\/maps\.apple\.com/);
    await expect(editor).toHaveValue(new RegExp(escapeRegExp(PASSAGE.body)));
    await expect(page.getByTestId("draft-flags")).not.toContainText(
      "the model was not allowed",
    );
    await expect(page.getByTestId("passages-used")).toHaveAttribute("data-count", "1");

    // Exported through the same gate.
    await page.getByTestId("export-draft").click();
    await expect(page.getByTestId("export-state")).toContainText(
      "Copied to the clipboard",
    );
    await page.getByTestId("back-to-drafts").click();

    // The audit CSV: a row with an empty model and template, the ruleset version present.
    const csvDownloading = page.waitForEvent("download");
    await page.getByTestId("export-audit-log").click();
    const csv = readFileSync((await (await csvDownloading).path())!, "utf8");
    const [header, record] = csv.split("\r\n");
    const columns = header!.split(",");
    const cells = record!.split(",");
    const at = (name: string) => cells[columns.indexOf(name)];
    expect(at("model")).toBe("");
    expect(at("promptTemplateVersion")).toBe("");
    expect(at("guardrailRulesetVersion")).toMatch(/^\d+\.\d+\.\d+$/);
    expect(at("flagsFired")).toBe("claim-bearing");
    expect(at("exportedAt")).not.toBe("");

    // The briefing draws the site map: one embedded image, and no attendee photo.
    await page.getByTestId("active-event").selectOption("__briefing__");
    await expect(page.getByTestId("briefing-site-map-state")).toContainText(
      "A site map is stored",
    );
    const pdfDownloading = page.waitForEvent("download");
    await page.getByTestId("briefing-generate").click();
    const pdfBytes = readFileSync((await (await pdfDownloading).path())!);
    expect(pdfBytes.toString("latin1").match(/\/Subtype \/Image/g)?.length).toBe(1);
    expect((await PDFDocument.load(pdfBytes)).getPageCount()).toBeGreaterThanOrEqual(1);

    // The model route was never called, and nothing left the origin.
    expect(requests.filter((url) => new URL(url).pathname.startsWith("/api/"))).toEqual(
      [],
    );
    expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);
  });
});
