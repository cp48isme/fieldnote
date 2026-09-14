/**
 * Loading approved copy into the library: the only way a passage gets in, and the place
 * it is refused.
 *
 * The repository stores; this decides. A passage is refused, with the rule named, when
 * the pricing, hospitality, patient, or invented-name rule fires on it, or when the
 * pseudonymizer's structural guard would reject it — because an approved span is
 * exempt from every rule once it is in the draft (ruleset 1.3.0), and the exemption is
 * only honest if nothing gets in that the rules exist to keep out. Claim-bearing and
 * indication language are what approved copy is made of and are not checked here.
 *
 * The public build ships with an empty library. The representative loads real passages
 * in the private fork; the fixtures under `tests/fixtures/` are invented about the
 * synthetic device.
 */

import {
  addApprovedContent,
  updateApprovedContent,
  type ApprovedContentRecord,
  type Id,
  type NewApprovedContentInput,
} from "@/lib/db";
import { refusalFor } from "@/lib/generation/approved";

export class PassageRefusedError extends Error {
  constructor(readonly rule: string) {
    super(
      rule === "pseudonymization"
        ? "This passage names a person after a title, which cannot be sent to the model."
        : `This passage would be blocked by the ${rule} rule, so it cannot be approved copy for a follow-up.`,
    );
    this.name = "PassageRefusedError";
  }
}

function check(input: NewApprovedContentInput): void {
  if (input.body.trim().length === 0) throw new Error("A passage needs a body");
  if (input.label.trim().length === 0) throw new Error("A passage needs a label");
  const rule = refusalFor(input.body);
  if (rule !== null) throw new PassageRefusedError(rule);
}

export async function loadPassage(
  input: NewApprovedContentInput,
): Promise<ApprovedContentRecord> {
  check(input);
  return addApprovedContent(input);
}

export async function replacePassage(
  id: Id,
  input: NewApprovedContentInput,
): Promise<ApprovedContentRecord> {
  check(input);
  return updateApprovedContent(id, input);
}
