/**
 * Crash recovery.
 *
 * The prototype lost an afternoon's notes when a tab closed, and the build guide is
 * explicit that recovery is built first so everything else inherits it.
 *
 * The mechanism is a session marker with a heartbeat. On load a marker is written with
 * `endedAt: null`; a clean shutdown sets `endedAt`. Any marker still open on the next
 * load belonged to a session that died — a crash, a force quit, a killed tab — and the
 * notes it touched are surfaced as a recovered session.
 *
 * The recovery state is explicit rather than silent, per the session brief. The data is
 * already on disk because autosave put it there; what recovery adds is telling the user
 * that the previous session ended unexpectedly and which notes were in flight. A silent
 * restore leaves someone unsure whether what they are looking at is what they wrote.
 */

import {
  clearSessionMarkers,
  getSessionMarker,
  insertSessionMarker,
  listOpenSessionMarkers,
  makeSessionMarker,
  updateSessionMarker,
} from "./repository";
import type { Id, SessionMarkerRecord } from "./schema";
import { isPersistenceAvailable } from "./database";

/** How often the live session refreshes `lastSeenAt`. */
export const HEARTBEAT_MS = 1_000;

export interface RecoveredSession {
  markerIds: Id[];
  /** When the dead session was last known alive. */
  lastSeenAt: number;
  /** Notes written during the dead session. May be empty if it died before any edit. */
  noteIds: Id[];
}

export interface SessionHandle {
  id: Id;
  /** Non-null when the previous session did not shut down cleanly. */
  recovered: RecoveredSession | null;
}

let current: SessionMarkerRecord | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

/**
 * Opens a session and reports any that died.
 *
 * Called once on app load. Reads open markers *before* writing its own, so the new
 * session never reports itself as recovered.
 */
export async function beginSession(): Promise<SessionHandle> {
  if (!isPersistenceAvailable()) {
    return { id: "unavailable", recovered: null };
  }

  const orphans = await listOpenSessionMarkers();

  const marker = makeSessionMarker();
  await insertSessionMarker(marker);
  current = marker;

  startHeartbeat();

  const recovered: RecoveredSession | null =
    orphans.length > 0
      ? {
          markerIds: orphans.map((o) => o.id),
          lastSeenAt: Math.max(...orphans.map((o) => o.lastSeenAt)),
          noteIds: [...new Set(orphans.flatMap((o) => o.touchedNoteIds))],
        }
      : null;

  return { id: marker.id, recovered };
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeat = setInterval(() => {
    void touchSession();
  }, HEARTBEAT_MS);
}

function stopHeartbeat(): void {
  if (heartbeat !== null) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

async function touchSession(): Promise<void> {
  if (!current) return;
  const updated: SessionMarkerRecord = { ...current, lastSeenAt: Date.now() };
  current = updated;
  await updateSessionMarker(updated);
}

/**
 * Records that a note was written in this session, so recovery can name what was in
 * flight rather than only that something was.
 */
export async function recordTouchedNote(noteId: Id): Promise<void> {
  if (!current) return;
  if (current.touchedNoteIds.includes(noteId)) return;
  const updated: SessionMarkerRecord = {
    ...current,
    touchedNoteIds: [...current.touchedNoteIds, noteId],
    lastSeenAt: Date.now(),
  };
  current = updated;
  await updateSessionMarker(updated);
}

/**
 * Marks a clean shutdown. Registered on `pagehide`, which fires on tab close and
 * navigation. It deliberately does not fire on a renderer crash or a force quit — that
 * asymmetry is what makes an open marker meaningful.
 */
export async function endSession(): Promise<void> {
  stopHeartbeat();
  if (!current) return;
  const latest = (await getSessionMarker(current.id)) ?? current;
  await updateSessionMarker({ ...latest, endedAt: Date.now() });
  current = null;
}

/**
 * Dismisses a recovery notice. Clears the dead markers so the banner does not reappear
 * on every subsequent load — the user has been told.
 */
export async function acknowledgeRecovery(recovered: RecoveredSession): Promise<void> {
  await clearSessionMarkers(recovered.markerIds);
}

/** Test seam. Discards in-memory session state without touching the database. */
export function resetSessionState(): void {
  stopHeartbeat();
  current = null;
}
