import { NextRequest, NextResponse } from 'next/server';
import {
  isGoogleMapsUrl,
  needsResolution,
  parseGoogleMapsUrl,
  resolveUrl,
} from '@/lib/parse-google-url';
import { resolveLocation } from '@/lib/google-api';
import { buildAppleLocationUrl, buildAppleDirectionsUrl } from '@/lib/apple-maps';

const MAX_URL_LENGTH = 2048;

export async function POST(request: NextRequest) {
  // ── Parse request body ──────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body', 400);
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('url' in body) ||
    typeof (body as Record<string, unknown>).url !== 'string'
  ) {
    return error('Request body must include a "url" string field', 400);
  }

  const rawUrl = ((body as Record<string, unknown>).url as string).trim();

  // ── Basic validation ────────────────────────────────────────────────────
  if (!rawUrl) return error('URL cannot be empty', 400);
  if (rawUrl.length > MAX_URL_LENGTH) return error('URL is too long', 400);
  if (!isGoogleMapsUrl(rawUrl)) return error('Please enter a valid Google Maps link', 400);

  // ── Resolve shortened URLs (maps.app.goo.gl / goo.gl/maps) ─────────────
  let resolvedUrl = rawUrl;
  if (needsResolution(rawUrl)) {
    resolvedUrl = await resolveUrl(rawUrl);
  }

  // ── Parse URL structure ─────────────────────────────────────────────────
  const parsed = parseGoogleMapsUrl(resolvedUrl);
  if (parsed.type === 'unknown') {
    return error(
      'Could not parse this Google Maps URL. Try copying the full link from Google Maps.',
      400
    );
  }

  try {
    // ── Single location ───────────────────────────────────────────────────
    if (parsed.type === 'place') {
      const location = await resolveLocation(parsed);

      if (location) {
        const appleUrl = buildAppleLocationUrl(location);
        return NextResponse.json({ type: 'place', location, appleUrl });
      }

      // Geocoding failed (e.g. API not enabled) but we have a text query —
      // fall back to an Apple Maps search URL so Apple Maps can locate it.
      if (parsed.query) {
        const appleUrl = `https://maps.apple.com/?q=${encodeURIComponent(parsed.query)}`;
        const fallback = { name: parsed.query, formattedAddress: parsed.query, lat: null, lng: null };
        return NextResponse.json({ type: 'place', location: fallback, appleUrl });
      }

      return error('Could not find this location', 404);
    }

    // ── Directions ────────────────────────────────────────────────────────
    if (parsed.type === 'directions') {
      console.log('[convert] parsed stops:', JSON.stringify(parsed.stops));
      const settled = await Promise.all(
        parsed.stops.map((stop) => resolveLocation(stop))
      );
      console.log('[convert] resolved stops (null = failed):', JSON.stringify(settled));
      const stops = settled.filter(
        (s): s is NonNullable<typeof s> => s !== null
      );

      if (stops.length < 2) {
        return error('Could not resolve enough stops to build directions', 400);
      }

      const { appleUrl, legs } = buildAppleDirectionsUrl(stops, parsed.travelMode);
      return NextResponse.json({
        type: 'directions',
        stops,
        appleUrl,
        legs,
        isMultiStop: stops.length > 2,
      });
    }
  } catch (err) {
    // Log internally but never expose raw error messages to clients
    console.error('[/api/convert]', err);
    return error('Conversion failed — please try again', 500);
  }

  return error('Unexpected input', 400);
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
