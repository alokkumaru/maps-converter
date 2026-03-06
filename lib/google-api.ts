/**
 * Server-side only — never import this in client components.
 * All calls use GOOGLE_MAPS_API_KEY from server environment variables.
 */
import { LocationResult } from './types';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

function requireKey(): string {
  if (!API_KEY) throw new Error('GOOGLE_MAPS_API_KEY is not configured.');
  return API_KEY;
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

async function geocode(address: string): Promise<LocationResult | null> {
  const key = requireKey();
  const params = new URLSearchParams({ address, key });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.[0]) return null;

  const r = data.results[0];
  // Prefer a specific place name from address components over the generic address
  const types = ['point_of_interest', 'establishment', 'premise', 'route'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const named = (r.address_components ?? []).find((c: any) =>
    types.some((t) => c.types.includes(t))
  );
  const name = named?.long_name ?? r.formatted_address.split(',')[0];

  return {
    name,
    formattedAddress: r.formatted_address ?? '',
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    placeId: r.place_id,
  };
}

// ─── Reverse Geocoding ────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<LocationResult> {
  const key = requireKey();
  const params = new URLSearchParams({ latlng: `${lat},${lng}`, key });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json();

  if (data.status !== 'OK' || !data.results?.[0]) {
    // Graceful fallback — just use the raw coordinates
    return { name: `${lat}, ${lng}`, formattedAddress: `${lat}, ${lng}`, lat, lng };
  }

  const r = data.results[0];
  const types = ['point_of_interest', 'establishment', 'premise', 'route'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const named = (r.address_components ?? []).find((c: any) =>
    types.some((t) => c.types.includes(t))
  );
  const name = named?.long_name ?? r.formatted_address.split(',')[0];

  return {
    name,
    formattedAddress: r.formatted_address ?? '',
    lat,
    lng,
    placeId: r.place_id,
  };
}

// ─── Main resolver (exported) ─────────────────────────────────────────────────

/**
 * Given a parsed stop (which may have a text query, coordinates, or both),
 * resolve it to a full LocationResult using Google APIs.
 *
 * Strategy:
 *  1. Coords available → use them directly; reverse geocode for display name
 *  2. Name only        → geocode to obtain coordinates
 */
export async function resolveLocation(
  stop: { query?: string; lat?: number; lng?: number }
): Promise<LocationResult | null> {
  try {
    const hasCoords = stop.lat !== undefined && stop.lng !== undefined;
    const hasQuery = Boolean(stop.query?.trim());

    // Coordinates from the Google Maps URL are authoritative — use them directly.
    if (hasCoords) {
      return reverseGeocode(stop.lat!, stop.lng!);
    }

    // No coordinates — geocode the text query to get coordinates.
    if (hasQuery) {
      return geocode(stop.query!);
    }

    return null;
  } catch (err) {
    console.error('[google-api] resolveLocation error:', err);
    return null;
  }
}
