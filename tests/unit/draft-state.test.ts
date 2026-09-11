/**
 * The draft state machine's two load-bearing properties, asserted against the table
 * rather than against one row of it.
 *
 * Plan §4.3 and CLAUDE.md: export is impossible from `generated`. Session 6's owner
 * decision: a blocked draft cannot reach `exported` by any route, including one added
 * carelessly later. Both are graph properties — what is reachable from where — so the
 * tests walk the graph. Adding `exported` to `generated`'s list, or any edge out of
 * `blocked`, fails here.
 *
 * To confirm these actually fail: edit `DRAFT_TRANSITIONS` in `src/lib/db/draft-state.ts`
 * so that `generated: ["reviewed", "exported"]`, or `blocked: ["generated"]`, and run
 * `pnpm test`. Both were done while writing this file.
 */

import { describe, expect, it } from "vitest";

import {
  DRAFT_TRANSITIONS,
  DraftStateError,
  assertTransition,
  canExport,
  canTransition,
  reachableFrom,
  type DraftState,
} from "@/lib/db";

const STATES = Object.keys(DRAFT_TRANSITIONS) as DraftState[];

describe("draft state machine", () => {
  it("names every state exactly once and every target is a state", () => {
    expect(STATES.sort()).toEqual(["blocked", "exported", "generated", "reviewed"]);
    for (const from of STATES) {
      for (const to of DRAFT_TRANSITIONS[from]) {
        expect(STATES, `${from} → ${to}`).toContain(to);
      }
    }
  });

  it("makes exported reachable only through reviewed", () => {
    // The only edge into `exported` leaves `reviewed`. Not "generated cannot export"
    // alone — that would pass with a new state that could.
    const into = STATES.filter((from) => DRAFT_TRANSITIONS[from].includes("exported"));
    expect(into).toEqual(["reviewed"]);
    expect(canExport("generated")).toBe(false);
    expect(canExport("reviewed")).toBe(true);
  });

  it("lets nothing out of blocked, by any route", () => {
    expect(DRAFT_TRANSITIONS.blocked).toEqual([]);
    expect(reachableFrom("blocked").size).toBe(0);
    expect(canExport("blocked")).toBe(false);
  });

  it("lets nothing out of exported", () => {
    expect(reachableFrom("exported").size).toBe(0);
  });

  it("walks generated → reviewed → exported and nothing shorter", () => {
    expect(canTransition("generated", "reviewed")).toBe(true);
    expect(canTransition("reviewed", "exported")).toBe(true);
    expect(canTransition("generated", "exported")).toBe(false);
    expect(reachableFrom("generated")).toEqual(new Set(["reviewed", "exported"]));
  });

  it("throws a typed error on an illegal transition", () => {
    expect(() => assertTransition("generated", "exported")).toThrow(DraftStateError);
    expect(() => assertTransition("blocked", "reviewed")).toThrow(DraftStateError);
    expect(() => assertTransition("reviewed", "exported")).not.toThrow();
  });
});
