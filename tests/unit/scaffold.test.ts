import { describe, expect, it } from "vitest";

// Placeholder proving the unit harness runs in a jsdom environment.
// Replace with real tests as the data layer lands; do not delete the harness.
describe("scaffold", () => {
  it("runs in a jsdom environment", () => {
    expect(typeof document).toBe("object");
  });
});
