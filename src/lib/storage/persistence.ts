/**
 * Asking the browser to keep the store, and reporting what it says.
 *
 * WHY. `fieldnote-bdw`: on iOS, script-writable storage is deleted after seven days of
 * Safari use without interaction on the site, and a home-screen web app is exempt — but
 * a persisted origin is exempt from eviction under storage pressure as well, and WebKit
 * grants persistence on heuristics that include being installed to the home screen. The
 * application has never asked. Asking is one line and costs nothing; not asking leaves
 * the only protection to an exemption nobody has confirmed applies.
 *
 * WHAT THIS IS NOT. It is not a guarantee and it is not a test of the seven-day window,
 * which only waiting seven days can test. It moves the question from "unknown" to "the
 * browser says yes" or "the browser says no", which are different worlds: yes means both
 * layers are on the application's side, no means the home-screen exemption is the only
 * protection and the storage-pressure case is open.
 *
 * WHAT IT RECORDS. Nothing. No field, no schema change, no migration; `navigator.storage`
 * is the record, and the settings screen reads it back on demand. A boolean copied into
 * IndexedDB would be a second answer that goes stale the moment the browser changes its
 * mind.
 *
 * FAILURE IS NEVER FATAL. Every call is wrapped: an older browser has no
 * `navigator.storage`, a private window can throw, and neither is a reason the
 * application should not start. The capture path is the thing that must not break.
 */

/** What `navigator.storage.persisted()` says, or that it could not be asked. */
export type PersistenceState = "persistent" | "not-persistent" | "unknown";

/**
 * Asks the browser to keep this origin's storage. Returns what it answered, or `unknown`
 * when there is nothing to ask. Safe to call on every start: the specification defines a
 * repeat call on an already-persisted origin as a no-op that resolves true.
 */
export async function requestPersistentStorage(): Promise<PersistenceState> {
  try {
    if (typeof navigator === "undefined") return "unknown";
    const storage = navigator.storage;
    if (!storage || typeof storage.persist !== "function") return "unknown";
    return (await storage.persist()) ? "persistent" : "not-persistent";
  } catch {
    // A browser that throws here is a browser that will not tell us, which is `unknown`.
    return "unknown";
  }
}

/** Reads back what the browser currently reports, without asking it to change anything. */
export async function readPersistenceState(): Promise<PersistenceState> {
  try {
    if (typeof navigator === "undefined") return "unknown";
    const storage = navigator.storage;
    if (!storage || typeof storage.persisted !== "function") return "unknown";
    return (await storage.persisted()) ? "persistent" : "not-persistent";
  } catch {
    return "unknown";
  }
}

/** The one place the three states are put into words, so the screen and its test agree. */
export const PERSISTENCE_WORDING: Readonly<Record<PersistenceState, string>> = {
  persistent: "Storage on this device: persistent",
  "not-persistent": "Storage on this device: not persistent",
  unknown: "Storage on this device: unknown",
};
