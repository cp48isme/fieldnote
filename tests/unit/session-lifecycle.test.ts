/**
 * The session marker lifecycle, and `resumeSession` in particular.
 *
 * Closes bead `fieldnote-5pr`: the tab-hidden-then-visible path was wired and typechecked
 * through session 2 but never tested, and it is load-bearing. A tab that is backgrounded
 * closes its session marker; without `resumeSession` reopening that same marker when the
 * tab comes back, the session is marked closed for good, and a crash *after* returning to
 * the tab reports nothing. The user loses the notice that tells them what was in flight —
 * silently, which is the worst way for a recovery signal to fail.
 *
 * The repository is faked rather than run against IndexedDB. jsdom has none, this repo has
 * no fake-indexeddb dependency, and adding one to test in-memory bookkeeping would be a
 * dependency bought for a single test. The storage path itself is covered end to end by
 * `tests/e2e/persistence.spec.ts` against a real browser; what is under test here is the
 * state machine, which is where the untested path was.
 *
 * All data is synthetic, per ADR-0001. No note bodies appear at all — markers hold ids.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionMarkerRecord } from "@/lib/db";

const store = vi.hoisted(() => ({
  markers: new Map<string, SessionMarkerRecord>(),
  created: 0,
}));

vi.mock("@/lib/db/database", () => ({
  isPersistenceAvailable: () => true,
}));

vi.mock("@/lib/db/repository", () => ({
  makeSessionMarker: (): SessionMarkerRecord => {
    store.created += 1;
    const timestamp = Date.now();
    return {
      id: `marker-${store.created}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: 1,
      startedAt: timestamp,
      lastSeenAt: timestamp,
      endedAt: null,
      touchedNoteIds: [],
    };
  },
  insertSessionMarker: async (marker: SessionMarkerRecord) => {
    store.markers.set(marker.id, marker);
  },
  updateSessionMarker: async (marker: SessionMarkerRecord) => {
    store.markers.set(marker.id, marker);
  },
  listOpenSessionMarkers: async (excludeId?: string) =>
    [...store.markers.values()]
      .filter((marker) => marker.endedAt === null && marker.id !== excludeId)
      .sort((a, b) => b.startedAt - a.startedAt),
  getSessionMarker: async (id: string) => store.markers.get(id),
  clearSessionMarkers: async (ids: string[]) => {
    for (const id of ids) store.markers.delete(id);
  },
}));

const { beginSession, endSession, resumeSession, resetSessionState, recordTouchedNote } =
  await import("@/lib/db/recovery");

/** Backgrounding a tab: the app closes cleanly on `visibilitychange` → hidden. */
async function tabHidden(): Promise<void> {
  await endSession();
}

/** Returning to it. */
async function tabVisible(): Promise<void> {
  await resumeSession();
}

function openMarkers(): SessionMarkerRecord[] {
  return [...store.markers.values()].filter((marker) => marker.endedAt === null);
}

beforeEach(() => {
  store.markers.clear();
  store.created = 0;
  resetSessionState();
});

afterEach(() => {
  resetSessionState();
});

describe("resumeSession", () => {
  it("reopens the marker that hiding the tab closed, rather than starting a new one", async () => {
    const { id } = await beginSession();

    await tabHidden();
    expect(store.markers.get(id)?.endedAt).not.toBeNull();

    await tabVisible();

    expect(store.markers.get(id)?.endedAt).toBeNull();
    // The same marker, reopened. Toggling tabs all afternoon must not accumulate rows.
    expect(store.markers.size).toBe(1);
    expect(store.created).toBe(1);
  });

  it("leaves a crash after the tab returns discoverable", async () => {
    // This is the regression the bead is about. Hide, return, then die without a clean
    // shutdown — exactly what a force quit or a renderer crash looks like.
    await beginSession();
    await tabHidden();
    await tabVisible();

    // No endSession: the session dies here. A fresh load reads what is left behind.
    resetSessionState();
    const next = await beginSession();

    expect(next.recovered).not.toBeNull();
    expect(next.recovered?.markerIds).toHaveLength(1);
  });

  it("would lose that crash if the marker were left closed", async () => {
    // The counterexample, so the test above is known to be asserting something. Same
    // sequence with no resume: the dead session reports nothing.
    await beginSession();
    await tabHidden();

    resetSessionState();
    const next = await beginSession();

    expect(next.recovered).toBeNull();
  });

  it("carries the notes touched before hiding into the reopened session", async () => {
    const { id } = await beginSession();
    await recordTouchedNote("note-synthetic-1");
    await tabHidden();
    await tabVisible();
    await recordTouchedNote("note-synthetic-2");

    expect(store.markers.get(id)?.touchedNoteIds).toEqual([
      "note-synthetic-1",
      "note-synthetic-2",
    ]);
  });

  it("does nothing when a session is already live", async () => {
    await beginSession();
    await tabVisible();

    expect(openMarkers()).toHaveLength(1);
    expect(store.created).toBe(1);
  });

  it("does nothing when there is no suspended session to reopen", async () => {
    await tabVisible();

    expect(store.markers.size).toBe(0);
    expect(store.created).toBe(0);
  });
});
