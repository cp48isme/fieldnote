/**
 * The draft state machine. Plan §4.3, CLAUDE.md: `generated` → `reviewed` → `exported`,
 * and export is impossible until a human has opened the draft.
 *
 * One table, and everything else derives from it. The repository's transition functions
 * call `assertTransition` and nothing else decides; the review surface asks `canExport`
 * to know whether to enable the button, and that answer is read from the same table. So
 * there is exactly one place a transition can be added, and `tests/unit/draft-state.test.ts`
 * asserts the two properties that matter about the table itself: that `exported` is
 * reachable only through `reviewed`, and that `blocked` reaches nothing — by any route,
 * including one added carelessly later, because the test walks the graph rather than
 * reading one row.
 *
 * Why `blocked` is a state rather than a flag on `generated`: a flag is a check that
 * some later code path can forget to make. A state with no outgoing edge cannot be
 * transitioned out of by any function that goes through this table, and every function
 * that writes `state` does.
 */

import type { DraftState } from "./schema";

/** From each state, the states it may move to. Order is meaningless. */
export const DRAFT_TRANSITIONS: Readonly<Record<DraftState, readonly DraftState[]>> = {
  generated: ["reviewed"],
  reviewed: ["exported"],
  exported: [],
  blocked: [],
};

export class DraftStateError extends Error {
  constructor(
    readonly from: DraftState,
    readonly to: DraftState,
  ) {
    super(`A draft in state "${from}" cannot move to "${to}".`);
    this.name = "DraftStateError";
  }
}

export function canTransition(from: DraftState, to: DraftState): boolean {
  return DRAFT_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DraftState, to: DraftState): void {
  if (!canTransition(from, to)) throw new DraftStateError(from, to);
}

/** Whether export is the next legal step. Read by the review surface, never assumed. */
export function canExport(state: DraftState): boolean {
  return canTransition(state, "exported");
}

/**
 * Whether the body may still be edited: only while export is still ahead. An exported
 * draft is the record of what was sent and is read-only; a blocked draft has no body.
 * Derived from the table, so a new state inherits the right answer.
 */
export function canEdit(state: DraftState): boolean {
  return reachableFrom(state).has("exported");
}

/** Every state reachable from `start` by following the table, `start` excluded. */
export function reachableFrom(start: DraftState): Set<DraftState> {
  const seen = new Set<DraftState>();
  const queue: DraftState[] = [...DRAFT_TRANSITIONS[start]];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...DRAFT_TRANSITIONS[next]);
  }
  return seen;
}
