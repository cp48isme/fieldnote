import { describe, expect, it } from "vitest";

import { dataUrlOf } from "@/lib/images/data-url";

describe("dataUrlOf", () => {
  it("encodes bytes with their media type", () => {
    expect(dataUrlOf(new Uint8Array([72, 105]).buffer, "image/jpeg")).toBe(
      "data:image/jpeg;base64,SGk=",
    );
  });

  it("handles a buffer larger than one chunk", () => {
    const big = new Uint8Array(100_000).fill(65);
    const url = dataUrlOf(big.buffer, "image/png");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(atob(url.slice("data:image/png;base64,".length))).toHaveLength(100_000);
  });
});
