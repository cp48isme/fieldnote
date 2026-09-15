/**
 * The pre-event email: composed from records, one per recipient, the whole body through
 * the ruleset with library passages exempt. Every string synthetic (ADR-0001).
 */

import { describe, expect, it } from "vitest";

import { libraryVersionOf } from "@/lib/generation/approved";
import { GUARDRAIL_RULESET_VERSION } from "@/lib/generation/guardrails";
import { GAP_MARKER } from "@/lib/generation/prompt";
import {
  CALENDAR_LINE,
  composePreEvent,
  locationBlock,
  SITE_MAP_LINE,
  type PreEventInput,
} from "@/lib/preevent/compose";

import { APPROVED_FIXTURES } from "../fixtures/approved-content";
import { BRIEFING_EVENT } from "../fixtures/briefing";
import { ROSTER } from "../fixtures/dictation";

const LOGISTICS = [
  "Please arrive between 08:30 and 09:00; the session runs about ninety minutes.",
  "Theatre scrubs are fine, and there is nothing to prepare.",
].join(" ");

const base: PreEventInput = {
  event: { ...BRIEFING_EVENT, logistics: LOGISTICS },
  recipients: ROSTER.slice(0, 2),
  library: APPROVED_FIXTURES,
  selectedPassageIds: [APPROVED_FIXTURES[0]!.id, APPROVED_FIXTURES[1]!.id],
  siteMapStored: true,
  calendarAttached: true,
};

describe("composePreEvent", () => {
  it("writes one email per recipient with the greeting from the record and the same body", async () => {
    const outcomes = await composePreEvent(base);
    expect(outcomes.map((o) => o.attendeeId)).toEqual(
      ROSTER.slice(0, 2).map((a) => a.id),
    );
    const [first, second] = outcomes;
    expect(
      first!.body.startsWith(
        `Subject: Before ${BRIEFING_EVENT.name}\n\nDear ${ROSTER[0]!.displayName},\n\n`,
      ),
    ).toBe(true);
    expect(second!.body).toContain(`Dear ${ROSTER[1]!.displayName},`);
    expect(first!.inputHash).toBe(second!.inputHash);
    expect(first!.body.split("\n\n").slice(2).join("\n\n")).toBe(
      second!.body.split("\n\n").slice(2).join("\n\n"),
    );
  });

  it("carries the logistics, the location with both map links, the site map line, the passages verbatim, and a sign-off", async () => {
    const [email] = await composePreEvent(base);
    const body = email!.body;
    expect(body).toContain(LOGISTICS);
    expect(body).toContain("Where to find us");
    expect(body).toContain(BRIEFING_EVENT.address);
    expect(body).toContain("Apple Maps: https://maps.apple.com/?ll=51.500700,-0.124600");
    expect(body).toContain(
      "Google Maps: https://www.google.com/maps/search/?api=1&query=51.500700,-0.124600",
    );
    expect(body).toContain(SITE_MAP_LINE);
    expect(body).toContain(CALENDAR_LINE);
    expect(body).toContain(APPROVED_FIXTURES[0]!.body);
    expect(body).toContain(APPROVED_FIXTURES[1]!.body);
    expect(body.trimEnd().endsWith("Kind regards,")).toBe(true);
    // Clean text: nothing fired, nothing blanked, the two hashes agree.
    expect(email!.flagsFired).toEqual([]);
    expect(email!.blockedSentences).toBe(0);
    expect(email!.inputHash).toBe(email!.outputHash);
    expect(email!.passagesUsed).toEqual([
      APPROVED_FIXTURES[0]!.id,
      APPROVED_FIXTURES[1]!.id,
    ]);
    expect(email!.libraryVersion).toBe(await libraryVersionOf(APPROVED_FIXTURES));
    expect(email!.guardrailRulesetVersion).toBe(GUARDRAIL_RULESET_VERSION);
    expect(body).not.toContain(GAP_MARKER);
  });

  it("blanks a comparison she typed and leaves the passages beside it exact", async () => {
    const typed = `${LOGISTICS} Our console is faster than anything you have used before.`;
    const [email] = await composePreEvent({
      ...base,
      event: { ...base.event, logistics: typed },
    });
    expect(email!.flagsFired).toEqual(["claim-bearing"]);
    expect(email!.blockedSentences).toBe(1);
    expect(email!.body).toContain(GAP_MARKER);
    expect(email!.body).not.toContain("faster than anything");
    expect(email!.body).toContain(
      "Theatre scrubs are fine, and there is nothing to prepare.",
    );
    expect(email!.body).toContain(APPROVED_FIXTURES[0]!.body);
    expect(email!.passagesUsed).toEqual([
      APPROVED_FIXTURES[0]!.id,
      APPROVED_FIXTURES[1]!.id,
    ]);
    expect(email!.inputHash).not.toBe(email!.outputHash);
  });

  it("says nothing about the product with no passages selected, and nothing about a map with none stored", async () => {
    const [email] = await composePreEvent({
      ...base,
      selectedPassageIds: [],
      siteMapStored: false,
      calendarAttached: false,
    });
    for (const passage of APPROVED_FIXTURES)
      expect(email!.body).not.toContain(passage.body);
    expect(email!.body).not.toContain(SITE_MAP_LINE);
    expect(email!.body).not.toContain(CALENDAR_LINE);
    expect(email!.passagesUsed).toEqual([]);
    expect(email!.flagsFired).toEqual([]);
  });

  it("omits the links without coordinates, and the whole block without a location", () => {
    expect(locationBlock({ ...BRIEFING_EVENT, coordinates: "" }, false)).toEqual([
      "Where to find us",
      BRIEFING_EVENT.address,
    ]);
    expect(
      locationBlock({ ...BRIEFING_EVENT, address: "", coordinates: "" }, false),
    ).toEqual([]);
    expect(
      locationBlock({ ...BRIEFING_EVENT, address: "", coordinates: "" }, true),
    ).toEqual(["Where to find us", SITE_MAP_LINE]);
  });

  it("selects passages in library order whatever order she ticked them", async () => {
    const [email] = await composePreEvent({
      ...base,
      selectedPassageIds: [APPROVED_FIXTURES[1]!.id, APPROVED_FIXTURES[0]!.id],
    });
    expect(email!.passagesUsed).toEqual([
      APPROVED_FIXTURES[0]!.id,
      APPROVED_FIXTURES[1]!.id,
    ]);
  });
});
