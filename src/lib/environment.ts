"use client";

/**
 * What the browsing context can and cannot do.
 *
 * The only caller is the gate in front of the capture screen, but this is a module rather
 * than an inline check so the reason is written down once. `window.isSecureContext` is the
 * browser's own answer to "are the secure-context APIs available here", which is exactly
 * the question — rather than a guess assembled from the protocol and the hostname, which
 * gets `localhost`, `127.0.0.1`, `[::1]`, and file URLs wrong in different ways.
 *
 * Three things this project needs are gated on a secure context:
 *
 *   - `crypto.randomUUID`, which `src/lib/db/repository.ts` uses for every record id. On an
 *     insecure origin it is simply absent and the first write throws.
 *   - `navigator.serviceWorker`, without which there is no offline shell — plan §5
 *     non-negotiable 5, and the reason capture survives a dead signal at all.
 *   - `crypto.subtle`, which session 19's encryption will need in the private fork.
 *
 * Returns `true` during server rendering. Next renders these components on the server,
 * where there is no `window` and the question is meaningless; the client checks again on
 * mount, and that answer is the one that decides anything.
 */
export function isSecureOrigin(): boolean {
  if (typeof window === "undefined") return true;
  return window.isSecureContext;
}
