"use client";

/**
 * What the browser says about this origin's storage, read back on demand.
 *
 * A client component inside an otherwise server-rendered settings page, because
 * `navigator.storage.persisted()` can only be asked in a browser. Read-only: the asking
 * happens once at start-up (`service-worker-registration.tsx`), and this reports the
 * answer rather than changing it.
 *
 * Three states and no fourth. `unknown` covers a browser without the API and a browser
 * that throws, and it is shown rather than hidden: "we could not ask" is a different
 * thing from "no", and on the device check this line is the whole result
 * (`fieldnote-bdw`).
 */

import { useEffect, useState } from "react";

import {
  PERSISTENCE_WORDING,
  readPersistenceState,
  type PersistenceState,
} from "@/lib/storage/persistence";

export function StorageLine() {
  const [state, setState] = useState<PersistenceState | null>(null);

  useEffect(() => {
    let live = true;
    void readPersistenceState().then((answer) => {
      if (live) setState(answer);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <p data-testid="storage-state" data-state={state ?? "reading"} className="opacity-70">
      {state === null ? "Storage on this device: reading…" : PERSISTENCE_WORDING[state]}
    </p>
  );
}
