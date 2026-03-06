import { DirectionLeg, LocationResult } from './types';

const BASE = 'https://maps.apple.com/';

// Travel mode values for the /directions endpoint
const TRAVEL_MODE: Record<'driving' | 'walking' | 'transit', string> = {
  driving: 'driving',
  walking: 'walking',
  transit: 'transit',
};

// ─── Single location ──────────────────────────────────────────────────────────

/**
 * Builds an Apple Maps URL for a single location.
 * Example: https://maps.apple.com/?ll=48.8584,2.2945&q=Eiffel+Tower
 *
 * Note: commas in ll= must NOT be percent-encoded — build the URL manually.
 */
export function buildAppleLocationUrl(loc: LocationResult): string {
  return `${BASE}?ll=${loc.lat},${loc.lng}&q=${encodeURIComponent(loc.name)}`;
}

// ─── Directions ───────────────────────────────────────────────────────────────

/**
 * Builds an Apple Maps directions URL using the /directions endpoint, which
 * supports multi-stop routes natively via repeating `waypoint` parameters.
 *
 * Format:
 *   https://maps.apple.com/directions
 *     ?source=<lat%2Clng>
 *     &waypoint=<encoded address>   ← one per intermediate stop
 *     &waypoint-place-id=           ← paired with each waypoint (empty = no place ID)
 *     &destination=<lat%2Clng>
 *     &mode=driving|walking|transit
 *
 * The source/destination coordinates use encodeURIComponent so the comma
 * becomes %2C, which is what Apple Maps expects for that endpoint.
 */
export function buildAppleDirectionsUrl(
  stops: LocationResult[],
  travelMode: 'driving' | 'walking' | 'transit' = 'driving'
): { appleUrl: string; legs: DirectionLeg[] } {
  const origin = stops[0];
  const dest = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1);

  const parts: string[] = [
    `source=${encodeURIComponent(`${origin.lat},${origin.lng}`)}`,
  ];

  for (const wp of waypoints) {
    parts.push(`waypoint=${encodeURIComponent(wp.formattedAddress)}`);
    parts.push(`waypoint-place-id=`);
  }

  parts.push(`destination=${encodeURIComponent(`${dest.lat},${dest.lng}`)}`);
  parts.push(`mode=${TRAVEL_MODE[travelMode]}`);

  const appleUrl = `${BASE}directions?${parts.join('&')}`;

  // Individual leg links (consecutive pairs) — kept for API completeness
  const legs: DirectionLeg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    legs.push({
      from,
      to,
      appleUrl: `${BASE}?saddr=${from.lat},${from.lng}&daddr=${to.lat},${to.lng}&dirflg=d`,
    });
  }

  return { appleUrl, legs };
}
