/**
 * Coordinates as the event stores them: one string, "lat, lng", validated on entry.
 *
 * One string and not two numbers, so the cipher keeps its two shapes (ADR-0004). Two
 * decimal numbers separated by a comma, with optional whitespace; latitude in [-90, 90],
 * longitude in [-180, 180]. Nothing looser — a pasted "51°30'N" is refused rather than
 * guessed at, because the map links are built from this and a guess is a link to the
 * wrong place.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

const DECIMAL = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)";
const PAIR = new RegExp(`^\\s*(${DECIMAL})\\s*,\\s*(${DECIMAL})\\s*$`);

/** The parsed pair, or null when the text is not one. */
export function parseCoordinates(text: string): Coordinates | null {
  const match = PAIR.exec(text);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** "lat, lng" at six decimals — about ten centimetres — for a link. */
export function formatCoordinates({ lat, lng }: Coordinates): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}
