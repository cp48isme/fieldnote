/**
 * The pre-event email: composed from records, one per recipient, the whole body through
 * the ruleset with library passages exempt. Every string synthetic (ADR-0001).
 */

import { describe, expect, it } from "vitest";

import { libraryVersionOf } from "@/lib/generation/approved";
import { GUARDRAIL_RULESET_VERSION } from "@/lib/generation/guardrails";
import { GAP_MARKER } from "@/lib/generation/prompt";
import { parseCoordinates } from "@/lib/location/coordinates";
import { appleMapsLink, googleMapsLink } from "@/lib/location/map-links";
import { applyGuardrails } from "@/lib/generation/guardrails";
import {
  CALENDAR_LINE,
  composePreEvent,
  formatWhen,
  FORWARDABLE_CLOSING,
  FORWARDABLE_END,
  FORWARDABLE_HEADING,
  FORWARDABLE_OPENING,
  forwardableBlock,
  locationBlock,
  SITE_MAP_LINE,
  WHEN_LABEL,
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

/**
 * ADR-0002's five constraints, "all enforced in code rather than by policy". Each is a
 * test here, and the block's shape is what makes each hold: it has no input of its own,
 * it is the same for every recipient, its links are the map links and nothing else, and
 * it goes through the ruleset with the rest of the body.
 */
describe("the forwardable block (ADR-0002)", () => {
  const enabled: PreEventInput = {
    ...base,
    event: { ...base.event, forwardableEnabled: true },
  };
  /** The block as it stands in the composed email, heading to end marker. */
  const blockOf = (body: string): string => {
    const from = body.indexOf(FORWARDABLE_HEADING);
    const to = body.indexOf(FORWARDABLE_END);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    return body.slice(from, to + FORWARDABLE_END.length);
  };

  it("ships disabled: an event with the flag off composes exactly the email it did before", async () => {
    expect(base.event.forwardableEnabled).toBe(false);
    expect(forwardableBlock(base.event, [])).toEqual([]);
    const [email] = await composePreEvent(base);
    expect(email!.body).not.toContain(FORWARDABLE_HEADING);
    expect(email!.body).not.toContain(FORWARDABLE_END);
  });

  it("when on, is self-contained: the name, when, where, the logistics, and the passages, then the closing line", async () => {
    const [email] = await composePreEvent(enabled);
    const block = blockOf(email!.body);
    const when = formatWhen(base.event.startsAt, base.event.endsAt);
    expect(when).toMatch(/2026, \d{2}:\d{2} to \d{2}:\d{2}$/);
    const point = parseCoordinates(BRIEFING_EVENT.coordinates)!;
    expect(block.split("\n")).toEqual([
      FORWARDABLE_HEADING,
      FORWARDABLE_OPENING,
      "",
      BRIEFING_EVENT.name,
      `${WHEN_LABEL} ${when}`,
      "Where to find us",
      BRIEFING_EVENT.address,
      "Coordinates: 51.5007, -0.1246",
      `Apple Maps: ${appleMapsLink(point)}`,
      `Google Maps: ${googleMapsLink(point)}`,
      "",
      LOGISTICS,
      "",
      APPROVED_FIXTURES[0]!.body,
      "",
      APPROVED_FIXTURES[1]!.body,
      "",
      FORWARDABLE_CLOSING,
      FORWARDABLE_END,
    ]);
    // The attachment lines stay out: an attachment does not travel with a forwarded block.
    expect(block).not.toContain(SITE_MAP_LINE);
    expect(block).not.toContain(CALENDAR_LINE);
    // It is the email's last section before the sign-off.
    expect(email!.body.trimEnd().endsWith(`${FORWARDABLE_END}\n\nKind regards,`)).toBe(
      true,
    );
    expect(email!.flagsFired).toEqual([]);
  });

  it("no tracking, link decoration, unique URL, or referral attribution: the same block for every recipient and every composition, with the two map links as its only URLs", async () => {
    const first = await composePreEvent(enabled);
    const again = await composePreEvent(enabled);
    const blocks = [...first, ...again].map((o) => blockOf(o.body));
    expect(new Set(blocks).size).toBe(1);
    const block = blocks[0]!;
    for (const recipient of enabled.recipients)
      expect(block).not.toContain(recipient.displayName);
    expect(block).not.toContain(enabled.recipients[0]!.id);
    const point = parseCoordinates(BRIEFING_EVENT.coordinates)!;
    const urls = block.match(/https?:\/\/\S+/g) ?? [];
    expect(urls.sort()).toEqual([appleMapsLink(point), googleMapsLink(point)].sort());
  });

  it("no incentive and no collection of anyone's details: the fixed strings are the only text that is not a record field, and they pass the ruleset clean", () => {
    const bare = forwardableBlock(
      {
        ...base.event,
        forwardableEnabled: true,
        startsAt: null,
        endsAt: null,
        address: "",
        coordinates: "",
        logistics: "",
      },
      [],
    );
    expect(bare).toEqual([
      FORWARDABLE_HEADING,
      FORWARDABLE_OPENING,
      "",
      BRIEFING_EVENT.name,
      "",
      FORWARDABLE_CLOSING,
      FORWARDABLE_END,
    ]);
    const fixed = [
      FORWARDABLE_HEADING,
      FORWARDABLE_OPENING,
      FORWARDABLE_CLOSING,
      FORWARDABLE_END,
    ];
    const { flagsFired, blockedSentences } = applyGuardrails(fixed.join(" "));
    expect(flagsFired).toEqual([]);
    expect(blockedSentences).toBe(0);
    for (const line of fixed) {
      expect(line).not.toMatch(
        /\b(?:email|phone|number|details|reply with|send us|let us know who)\b/i,
      );
      expect(line).not.toMatch(
        /\b(?:reward|gift|voucher|thank-you|thank you|free|prize|discount)\b/i,
      );
    }
  });

  it("is claim-bearing like the rest: a comparison she typed is a gap in the block too, and the passages beside it stay exact and are counted once", async () => {
    const typed = `${LOGISTICS} Our console is faster than anything you have used before.`;
    const [email] = await composePreEvent({
      ...enabled,
      event: { ...enabled.event, logistics: typed },
    });
    expect(email!.flagsFired).toEqual(["claim-bearing"]);
    expect(email!.blockedSentences).toBe(2);
    const block = blockOf(email!.body);
    expect(block).toContain(GAP_MARKER);
    expect(block).not.toContain("faster than anything");
    expect(block).toContain(APPROVED_FIXTURES[0]!.body);
    expect(block).toContain(APPROVED_FIXTURES[1]!.body);
    expect(email!.passagesUsed).toEqual([
      APPROVED_FIXTURES[0]!.id,
      APPROVED_FIXTURES[1]!.id,
    ]);
  });

  it("writes when with an end on a later day in full, and omits it with no start", () => {
    const start = Date.UTC(2026, 9, 2, 8, 0);
    const oneLine = formatWhen(start, start + 8 * 3_600_000)!;
    expect(oneLine.match(/2026/g)).toHaveLength(1);
    const twoDays = formatWhen(start, start + 30 * 3_600_000)!;
    expect(twoDays.match(/2026/g)).toHaveLength(2);
    expect(formatWhen(start, null)).toMatch(/2026, \d{2}:\d{2}$/);
    expect(formatWhen(null, start)).toBeNull();
  });
});
