import { CaptureScreen } from "@/components/capture/CaptureScreen";
import { SecureContextGate } from "@/components/capture/SecureContextGate";

/**
 * The capture surface, and for now the whole app.
 *
 * The gate is outside the screen rather than inside it so that on an insecure origin the
 * screen never mounts, and therefore never touches the data layer. `crypto.randomUUID` and
 * `navigator.serviceWorker` are both absent there, so mounting and failing later is the
 * behaviour this replaces.
 */
export default function Home() {
  return (
    <SecureContextGate>
      <CaptureScreen />
    </SecureContextGate>
  );
}
