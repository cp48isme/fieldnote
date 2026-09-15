/**
 * Universal map links for the pre-event email, built from stored coordinates.
 *
 * THESE ARE STRINGS IN AN EMAIL, NEVER FETCHED. Nothing here or anywhere in the app opens
 * a connection to either host: the links are text the recipient taps in their own mail
 * client. `tests/unit/single-egress.test.ts` looks for call sites, not URL literals, and
 * stays green; this file makes no call. Plan §3.3: coordinates, not the address, because
 * a truck in a parking lot is not at the building's street address.
 *
 * Both forms open the platform's map app when tapped there and a web page otherwise.
 */

import { formatCoordinates, type Coordinates } from "./coordinates";

export function appleMapsLink(coordinates: Coordinates): string {
  const at = formatCoordinates(coordinates);
  return `https://maps.apple.com/?ll=${at}&q=${at}`;
}

export function googleMapsLink(coordinates: Coordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${formatCoordinates(coordinates)}`;
}
