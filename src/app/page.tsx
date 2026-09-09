import { connection } from "next/server";

import { CaptureScreen } from "@/components/capture/CaptureScreen";
import { SecureContextGate } from "@/components/capture/SecureContextGate";

/**
 * The capture surface, and for now the whole app.
 *
 * The gate is outside the screen rather than inside it so that on an insecure origin the
 * screen never mounts, and therefore never touches the data layer. `crypto.randomUUID` and
 * `navigator.serviceWorker` are both absent there, so mounting and failing later is the
 * behaviour this replaces.
 *
 * Rendered per request, not at build time. The Content Security Policy carries a nonce
 * minted per request in `src/proxy.ts`, and Next can only stamp that nonce onto the
 * scripts of a page it renders when the request arrives. `connection()` is the documented
 * way to say so. The page is a client-rendered shell either way, so the cost is one render
 * per navigation — and the service worker caches that render for offline use.
 */
export default async function Home() {
  await connection();
  return (
    <SecureContextGate>
      <CaptureScreen />
    </SecureContextGate>
  );
}
