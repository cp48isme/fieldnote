/**
 * The matcher proposes; it does not merge. What it compares, what it misses by design,
 * and the counterfactual that a proposal nobody confirmed changes nothing.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyRosterImport, createAttendee, listAttendees } from "@/lib/db";
import { setDatabase } from "@/lib/db/database";
import type { ImportedPerson } from "@/lib/roster/header";
import { proposeMatches } from "@/lib/roster/match";

import { ROSTER } from "../fixtures/dictation";
import { FakeDatabase } from "./support/fake-database";

const person = (displayName: string, row = 0): ImportedPerson => ({
  row,
  displayName,
  role: "Consultant",
  specialty: "",
  institution: "Northgate Regional",
});

describe("proposeMatches", () => {
  it("matches exactly on the canonical name, titles stripped either side", () => {
    const [p] = proposeMatches([person("Dr Amara Okonjo-Baptiste")], ROSTER);
    expect(p!.candidate?.id).toBe("att-1");
    expect(p!.basis).toBe("exact");
    const [q] = proposeMatches([person("dr. peter vance")], ROSTER);
    expect(q!.candidate?.id).toBe("att-2");
    expect(q!.basis).toBe("exact");
  });

  it("falls back to the surname, and proposes each attendee once", () => {
    const [first, second] = proposeMatches(
      [person("Dr Vance", 0), person("Vance", 1)],
      ROSTER,
    );
    // Both rows share the surname with two Vances; row order claims one each.
    expect(first!.basis).toBe("surname");
    expect(second!.basis).toBe("surname");
    expect(new Set([first!.candidate!.id, second!.candidate!.id]).size).toBe(2);
  });

  it("proposes a one-letter slip on a long surname and not on a short one", () => {
    const [long] = proposeMatches([person("Dr Okonjo-Baptist")], ROSTER);
    expect(long!.basis).toBe("close");
    // "greene" against "green" is one edit on a five-letter surname: allowed.
    const [five] = proposeMatches([person("Dr Greene")], ROSTER);
    expect(five!.basis).toBe("close");
    // "pipe" against "piper" is one edit on a four-letter surname: not tried.
    const [tooShort] = proposeMatches([person("Tomas Pipe")], ROSTER);
    expect(tooShort!.candidate).toBeNull();
  });

  it("settles every exact match before any surname match, whatever the row order", () => {
    // The first end-to-end run: "Dr Peter Vance" on the row above "Marisol Vance" took her
    // by surname, and her own row then had nobody left. Exact wins across the sheet.
    const marisol = { ...ROSTER[2]! };
    const [peter, her] = proposeMatches(
      [person("Dr Peter Vance", 0), person("Marisol Vance", 1)],
      [marisol],
    );
    expect(her!.basis).toBe("exact");
    expect(her!.candidate?.id).toBe(marisol.id);
    expect(peter!.candidate).toBeNull();
  });

  it("misses the observed dictation mangling by design", () => {
    // ADR-0006: spoken Swali, transcribed Swelha. Three edits; no proposal.
    const captured = { ...ROSTER[0]!, id: "att-swali", displayName: "Dr. Swali" };
    const [p] = proposeMatches([person("Dr Swelha")], [captured]);
    expect(p!.candidate).toBeNull();
  });
});

describe("proposals are not decisions", () => {
  let db: FakeDatabase;
  beforeEach(() => {
    db = new FakeDatabase();
    setDatabase(db.asDatabase());
  });
  afterEach(() => setDatabase(null));

  it("changes nothing until a decision is confirmed, and merges only what was", async () => {
    // Counterfactual: a UI that fed proposals straight to applyRosterImport would merge
    // silently; the repository takes decisions, and a proposal is not one.
    const marisol = await createAttendee({ eventId: "e", displayName: "Marisol Vance" });
    const proposals = proposeMatches(
      [person("Vance", 0), person("Dr Green", 1)],
      [marisol],
    );
    expect(proposals[0]!.candidate?.id).toBe(marisol.id);
    expect((await listAttendees("e"))[0]!.role).toBe("");

    // The representative rejects the Vance proposal and accepts nothing.
    const { added, updated } = await applyRosterImport(
      "e",
      proposals.map((p) => ({
        kind: "new" as const,
        displayName: p.person.displayName,
        details: {
          role: p.person.role,
          specialty: p.person.specialty,
          institution: p.person.institution,
        },
      })),
    );
    expect(updated).toEqual([]);
    expect(added.map((a) => a.displayName)).toEqual(["Vance", "Dr Green"]);
    const after = await listAttendees("e");
    expect(after.find((a) => a.id === marisol.id)!.role).toBe("");
    expect(after).toHaveLength(3);
  });
});
