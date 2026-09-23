import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Retention, end to end, in a real browser against real IndexedDB. ADR-0013.
 *
 * The two things only a browser can answer: that the sweep on load actually removes an
 * event past its date and leaves the audit records behind, and that an event inside the
 * window shows the notice with a date on it. Both age the event the way she would — by
 * setting its end on the pre-event screen — rather than by writing a timestamp the
 * application would never write.
 *
 * All fixture data is synthetic, per ADR-0001.
 */

const DAY = 24 * 60 * 60 * 1000;

/**
 * The two periods, mirrored from `src/lib/db/retention.ts` rather than imported: that
 * module reaches Dexie through the repository, and pulling IndexedDB into the Node
 * process that drives the browser is a worse trade than restating two numbers. Every age
 * below is written against these, so a change to the policy moves the fixtures with it.
 */
const RETENTION_DAYS = 14;
const NOTICE_DAYS_BEFORE_DELETION = 7;
const NOTICE_FROM_DAY = RETENTION_DAYS - NOTICE_DAYS_BEFORE_DELETION;

/** `YYYY-MM-DDTHH:mm`, the shape a `datetime-local` input takes, in local time. */
function localInputValue(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Creates an event and sets its start and end, so the retention clock keys on `endsAt`. */
async function eventEndingAt(page: Page, name: string, endsAt: number): Promise<void> {
  await page.goto("/");
  await page.getByTestId("event-name").fill(name);
  await page.getByTestId("create-event").click();
  await expect(page.getByTestId("capture-dock")).toBeVisible();

  await page.getByTestId("note-body").fill("A note that ages with its event.");
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  await page.getByTestId("active-event").selectOption("__preevent__");
  await page
    .getByTestId("pre-event-starts")
    .fill(localInputValue(endsAt - 8 * 60 * 60 * 1000));
  await page.getByTestId("pre-event-ends").fill(localInputValue(endsAt));
  await page.getByTestId("pre-event-times-save").click();
  await expect(page.getByTestId("pre-event-times-state")).toContainText("Saved");
  await page.getByTestId("pre-event-close").click();
}

/** Every audit record in the store, read straight out of IndexedDB after a deletion. */
async function auditRecordCount(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    return await new Promise<number>((resolve, reject) => {
      const open = indexedDB.open("fieldnote");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("auditRecords", "readonly");
        const count = tx.objectStore("auditRecords").count();
        count.onsuccess = () => resolve(count.result);
        count.onerror = () => reject(count.error);
      };
    });
  });
}

test.describe("retention", () => {
  test("an event past its date is gone after a load, and its audit records are not", async ({
    page,
  }) => {
    await page.route("**/api/generate", async (route: Route) => {
      const request = route.request().postDataJSON() as { recipientToken: string };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: `Dear ${request.recipientToken},\n\nThank you.\n\nKind regards,`,
          blocked: null,
          model: "claude-opus-5",
          promptTemplateVersion: "1.0.0",
          flagsFired: [],
        }),
      });
    });

    // Ends well past the retention period, before the page is ever reloaded.
    await eventEndingAt(
      page,
      "Halewood mobile unit",
      Date.now() - (RETENTION_DAYS + 6) * DAY,
    );

    // A draft, so there is an audit record to outlive the event (ADR-0008).
    await page.getByTestId("toggle-add-attendee").click();
    await page.getByTestId("new-attendee-name").fill("Dr. Okonjo-Baptiste");
    await page.getByTestId("save-attendee").click();
    await expect(page.getByTestId("note-attendee")).not.toHaveValue("");
    await page.getByTestId("toggle-view").click();
    await page.getByTestId("draft-follow-ups").click();
    await expect(page.getByTestId("draft-row")).toHaveCount(1);

    expect(await auditRecordCount(page)).toBe(1);

    // The load is what runs the sweep: an installed app is not running when it is closed.
    await page.reload();

    // No event left, so the app is back to asking for one.
    await expect(page.getByTestId("event-name")).toBeVisible();
    await expect(page.getByTestId("capture-dock")).toHaveCount(0);
    await expect(page.getByTestId("retention-notice")).toHaveCount(0);

    // The record survived the deletion, orphaned on purpose.
    expect(await auditRecordCount(page)).toBe(1);
  });

  test("an event inside the window shows the notice with the date it will be deleted", async ({
    page,
  }) => {
    // Inside the notice window, with three days to go.
    const daysRemaining = 3;
    expect(daysRemaining).toBeLessThan(NOTICE_DAYS_BEFORE_DELETION);
    const endedAt = Date.now() - (RETENTION_DAYS - daysRemaining) * DAY;
    await eventEndingAt(page, "Carrowmore mobile unit", endedAt);

    const notice = page.getByTestId("retention-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("will be deleted on");
    await expect(notice).toContainText("The audit records are kept.");
    await expect(notice).toHaveAttribute("data-days-remaining", String(daysRemaining));

    // The date shown is the event's end plus the retention period, in the device's locale.
    const due = new Date(endedAt + RETENTION_DAYS * DAY);
    const expected = due.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    await expect(page.getByTestId("retention-date")).toHaveText(expected);

    // And it is still a notice: the event and its note are there.
    await expect(page.getByTestId("capture-dock")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("retention-notice")).toBeVisible();
  });

  test("an event well inside its life shows no notice", async ({ page }) => {
    // A day before the notice opens, so the window's edge is what this asserts.
    await eventEndingAt(
      page,
      "Northgate demonstration day",
      Date.now() - (NOTICE_FROM_DAY - 1) * DAY,
    );
    await expect(page.getByTestId("capture-dock")).toBeVisible();
    await expect(page.getByTestId("retention-notice")).toHaveCount(0);
  });
});
