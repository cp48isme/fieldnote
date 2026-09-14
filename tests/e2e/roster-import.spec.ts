import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * Roster import, end to end, in a real browser: the messy sign-in sheet through the
 * mapping and the match review into the event's attendees, with every network request
 * recorded so that "the file never touches the network" is shown rather than asserted.
 *
 * The walk-in constraint from `fieldnote-g7d` is exercised as the representative would
 * hit it: two people are added through the dock *before* the sheet is imported — one the
 * sheet also has, one the sheet has under a mangled spelling — and after import the dock
 * still adds a third person exactly as it did.
 *
 * All fixture data is synthetic, per ADR-0001: the roster's names, an invented site.
 */

const FIXTURES = join(process.cwd(), "tests", "fixtures");
const SITE = "Northgate demonstration day";

/** Added at the event before the sheet arrives. The second is the dictation mangling. */
const MET_COORDINATOR = "Marisol Vance";
const MET_MANGLED = "Dr. Swali";
/** Added from the dock after the import, to show that path is unchanged. */
const WALK_IN = "R. Vasquez, theatre coordinator";

async function startEventAndMeet(page: Page, names: string[]): Promise<void> {
  await page.goto("/");
  await page.getByTestId("event-name").fill(SITE);
  await page.getByTestId("create-event").click();
  await expect(page.getByTestId("capture-dock")).toBeVisible();
  for (const name of names) {
    await page.getByTestId("toggle-add-attendee").click();
    await page.getByTestId("new-attendee-name").fill(name);
    await page.getByTestId("save-attendee").click();
    await expect(page.getByTestId("note-attendee")).toContainText(name);
  }
}

async function openImport(page: Page): Promise<void> {
  await page.getByTestId("active-event").selectOption("__import__");
  await expect(page.getByTestId("roster-import")).toHaveAttribute("data-step", "pick");
}

/** Every request the page makes from now on, by URL. */
function recordRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  return urls;
}

test.describe("roster import", () => {
  test("imports the messy sheet through the mapping and the review, and the file never touches the network", async ({
    page,
  }) => {
    await startEventAndMeet(page, [MET_COORDINATOR, MET_MANGLED]);
    const origin = new URL(page.url()).origin;
    const requests = recordRequests(page);

    await openImport(page);
    await page
      .getByTestId("roster-file")
      .setInputFiles(join(FIXTURES, "roster-messy.xlsx"));

    // The header was found under the banner, and the guesses landed on the joined labels.
    await expect(page.getByTestId("roster-import")).toHaveAttribute("data-step", "map");
    await expect(page.getByTestId("roster-columns")).toContainText("Attendee Surname");
    await expect(page.getByTestId("roster-map-name")).toHaveValue("2");
    await expect(page.getByTestId("roster-map-title")).toHaveValue("1");
    await expect(page.getByTestId("roster-map-role")).toHaveValue("3");
    await page.getByTestId("roster-to-review").click();

    // The review: the sheet's two Vances are proposed against the one met; the mangled
    // Swelha is not proposed against Swali, by design; the rest are new.
    await expect(page.getByTestId("roster-import")).toHaveAttribute(
      "data-step",
      "review",
    );
    const proposals = page.getByTestId("roster-proposal");
    await expect(proposals).toHaveCount(1);
    await expect(proposals.first()).toContainText(MET_COORDINATOR);
    await expect(page.getByTestId("roster-new-list")).toContainText("Dr Swelha");
    await expect(page.getByTestId("roster-new-list")).not.toContainText(MET_MANGLED);

    // Nothing merges silently: the import button waits for an answer.
    await expect(page.getByTestId("roster-apply")).toBeDisabled();
    await proposals.first().getByTestId("roster-same").click();
    await expect(page.getByTestId("roster-apply")).toBeEnabled();
    await page.getByTestId("roster-apply").click();

    await expect(page.getByTestId("roster-summary")).toContainText("Added 5, updated 1");
    await page.getByTestId("roster-close").click();

    // The met coordinator kept her name and gained her role; the sheet's people are there.
    const options = page.getByTestId("note-attendee").locator("option");
    await expect(options).toHaveCount(1 + 2 + 5);
    await expect(page.getByTestId("note-attendee")).toContainText(MET_COORDINATOR);
    await expect(page.getByTestId("note-attendee")).not.toContainText("Vance, Marisol");
    await expect(page.getByTestId("note-attendee")).toContainText("Dr Swelha");
    await expect(page.getByTestId("note-attendee")).toContainText(MET_MANGLED);

    // No request left this origin, and none went to the API route.
    const foreign = requests.filter((url) => !url.startsWith(origin));
    expect(foreign).toEqual([]);
    expect(requests.filter((url) => new URL(url).pathname.startsWith("/api/"))).toEqual(
      [],
    );

    // The dock's add-person flow is unchanged after an import.
    await page.getByTestId("toggle-add-attendee").click();
    await page.getByTestId("new-attendee-name").fill(WALK_IN);
    await page.getByTestId("save-attendee").click();
    await expect(page.getByTestId("note-attendee")).toHaveValue(/.+/);
    await expect(page.getByTestId("note-attendee")).toContainText(WALK_IN);
  });

  test("refuses an .xls by its bytes, with the instruction to re-save", async ({
    page,
  }) => {
    await startEventAndMeet(page, []);
    await openImport(page);
    await page
      .getByTestId("roster-file")
      .setInputFiles(join(FIXTURES, "roster-legacy.xls"));
    await expect(page.getByTestId("roster-error")).toContainText(
      "save it again as .xlsx",
    );
    await expect(page.getByTestId("roster-import")).toHaveAttribute("data-step", "pick");
  });

  test("imports a .csv through its own reader, and a rejected proposal becomes a new person", async ({
    page,
  }) => {
    await startEventAndMeet(page, [MET_COORDINATOR]);
    await openImport(page);
    await page.getByTestId("roster-file").setInputFiles(join(FIXTURES, "roster.csv"));
    await expect(page.getByTestId("roster-map-name")).toHaveValue("0");
    await expect(page.getByTestId("roster-map-role")).toHaveValue("1");
    await page.getByTestId("roster-to-review").click();

    const proposal = page.getByTestId("roster-proposal").first();
    await expect(proposal).toContainText("same name");
    await proposal.getByTestId("roster-new").click();
    await page.getByTestId("roster-apply").click();
    await expect(page.getByTestId("roster-summary")).toContainText("Added 4, updated 0");
  });
});
