"use client";

/**
 * Stops the capture screen from mounting at all on an insecure origin.
 *
 * A gate rather than a flag threaded into the screen, because the requirement is that the
 * app does not *run* here — not that it runs with a warning. On an insecure origin
 * `crypto.randomUUID` is absent, so the first record write throws, and
 * `navigator.serviceWorker` is absent, so there is no offline capture. Both of those are
 * load-bearing. Letting the screen mount and fail later is how this presented in the first
 * place: an indefinite "Loading…" and an unhandled rejection in a console nobody in a car
 * park is reading.
 *
 * **This must be unreachable in production.** Vercel serves HTTPS, so `isSecureContext` is
 * true and this renders never. If it ever appears on a deployed build, that is a signal
 * that something is wrong with the deployment — not a routine warning to be lived with.
 * The e2e suite asserts it does not render on the ordinary test origin for that reason.
 *
 * The check runs on mount rather than during render because `window` does not exist on the
 * server. `null` for the first frame is the cost, and it is one frame.
 */

import { useEffect, useState } from "react";

import { isSecureOrigin } from "@/lib/environment";

import { BlockingNotice } from "./BlockingNotice";

type Verdict = "checking" | "secure" | "insecure";

export function SecureContextGate({ children }: { children: React.ReactNode }) {
  const [verdict, setVerdict] = useState<Verdict>("checking");

  useEffect(() => {
    setVerdict(isSecureOrigin() ? "secure" : "insecure");
  }, []);

  if (verdict === "checking") return null;

  if (verdict === "insecure") {
    return (
      <BlockingNotice
        testId="insecure-origin"
        title="This app needs HTTPS"
        explanation="It is open over plain HTTP on an address that is not localhost. Browsers withhold the features it depends on here: notes cannot be saved, and offline capture is unavailable, so it would stop working the moment the signal did."
        action="Open it over HTTPS, or on localhost. For testing on a phone over the local network, see docs/TESTING-ON-DEVICE.md."
      />
    );
  }

  return <>{children}</>;
}
