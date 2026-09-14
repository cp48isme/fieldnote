/**
 * Approved-content fixtures: the library the tests and the eval runner load.
 *
 * EVERY PASSAGE IS INVENTED ABOUT THE SYNTHETIC DEVICE — the open control console, the
 * sensor module, the probe port, the tooling kit — and written fresh. Not adapted: for
 * product copy the shape is the product, and a real sentence with the name swapped
 * still describes a device an industry reader identifies. No sentence structure, phrase
 * order, or paragraph shape from any real material is here, and nothing from
 * `private/` is. The regulatory-shaped passage is the same: a plausible shape, an
 * invented device, no real indication.
 *
 * Each passage is claim-bearing on its own to the ruleset — a product noun with a
 * descriptor, in the sender's voice — which is the point: outside the library it is
 * blocked, and inside it, copied exactly, it passes. `sourceRef` carries an invented
 * document code the way a real library would carry the approving document's.
 */

import type { ApprovedContentRecord } from "@/lib/db";

function passage(id: string, label: string, body: string): ApprovedContentRecord {
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 5,
    label,
    body,
    sourceRef: "SYN-DOC-0001 v1",
  };
}

export const APPROVED_FIXTURES: readonly ApprovedContentRecord[] = [
  passage(
    "fx-console",
    "Control console",
    "The open control console sits at eye level and is designed to move between rooms on its own stand.",
  ),
  passage(
    "fx-sensor",
    "Sensor module",
    "The sensor module is supplied as a matched pair and allows a check before every case.",
  ),
  passage(
    "fx-port",
    "Probe port",
    "The probe port on the console accepts the standard and the narrow probe without a change of tooling.",
  ),
  passage(
    "fx-kit",
    "Tooling kit",
    "The tooling kit ships in one case and is designed to be restocked from a single list.",
  ),
  passage(
    "fx-indication",
    "Indication statement",
    "The system is indicated for use with the sensor module in adult procedures; refer to the instructions for use for the full indication and its contraindications.",
  ),
];
