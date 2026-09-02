import { CaptureScreen } from "@/components/capture/CaptureScreen";

/**
 * The capture surface, and for now the whole app.
 *
 * This replaces session 2's data-layer harness. The harness existed to prove autosave and
 * crash recovery against a real browser; that behaviour is unchanged and still covered by
 * `tests/e2e/persistence.spec.ts`, which runs against this screen.
 */
export default function Home() {
  return <CaptureScreen />;
}
