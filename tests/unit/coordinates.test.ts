import { describe, expect, it } from "vitest";

import { formatCoordinates, parseCoordinates } from "@/lib/location/coordinates";
import { appleMapsLink, googleMapsLink } from "@/lib/location/map-links";

describe("parseCoordinates", () => {
  it("accepts two decimal numbers in range, however spaced", () => {
    expect(parseCoordinates("51.5007, -0.1246")).toEqual({ lat: 51.5007, lng: -0.1246 });
    expect(parseCoordinates("  -33.8688,151.2093 ")).toEqual({
      lat: -33.8688,
      lng: 151.2093,
    });
    expect(parseCoordinates("0,0")).toEqual({ lat: 0, lng: 0 });
  });

  it("refuses anything that is not that: degrees, a single number, out of range, words", () => {
    for (const bad of [
      "51°30'N 0°7'W",
      "51.5007",
      "91, 0",
      "0, 181",
      "north lot",
      "",
      "51.5, -0.1, 12",
    ]) {
      expect(parseCoordinates(bad), bad).toBeNull();
    }
  });
});

describe("map links", () => {
  const westminster = { lat: 51.5007, lng: -0.1246 };

  it("formats at six decimals and builds both links from the same pair", () => {
    expect(formatCoordinates(westminster)).toBe("51.500700,-0.124600");
    expect(appleMapsLink(westminster)).toBe(
      "https://maps.apple.com/?ll=51.500700,-0.124600&q=51.500700,-0.124600",
    );
    expect(googleMapsLink(westminster)).toBe(
      "https://www.google.com/maps/search/?api=1&query=51.500700,-0.124600",
    );
  });
});
