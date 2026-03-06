import { ParsedGoogleUrl } from './types';

// ─── Public helpers ──────────────────────────────────────────────────────────

export function isGoogleMapsUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    const validHostnames = [
      'maps.app.goo.gl',
      'goo.gl',
      'maps.google.com',
    ];
    if (validHostnames.includes(hostname)) return true;
    // google.com/maps or *.google.*/maps
    if (/^(www\.)?google\.[a-z.]{2,6}$/.test(hostname) && pathname.startsWith('/maps')) return true;
    return false;
  } catch {
    return false;
  }
}

export function needsResolution(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'maps.app.goo.gl' || hostname === 'goo.gl';
  } catch {
    return false;
  }
}

/** Follow redirects and return the final URL. */
export async function resolveUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MapsConverter/1.0)' },
    });
    // Consume minimal body then abort to avoid downloading the whole page
    controller.abort();
    return res.url || url;
  } catch {
    return url;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseGoogleMapsUrl(url: string): ParsedGoogleUrl {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const params = u.searchParams;

    // New directions API format: /maps/dir/?api=1&origin=...&destination=...
    if (params.has('origin') || params.has('destination')) {
      return parseNewDirectionsFormat(params);
    }

    // Old-style directions: ?saddr=...&daddr=...
    if (params.has('saddr') || params.has('daddr')) {
      return parseOldDirectionsFormat(params);
    }

    // Path-based directions: /maps/dir/A/B/C/
    if (path.includes('/dir/')) {
      return parsePathDirections(path);
    }

    // Named place: /maps/place/Name/@lat,lng,...
    if (path.includes('/place/')) {
      return parsePlaceUrl(path);
    }

    // Search: /maps/search/query/@lat,lng,...
    if (path.includes('/search/')) {
      const m = path.match(/\/maps\/search\/([^/@]+)/);
      const coords = extractCoords(path);
      if (m) {
        return { type: 'place', query: pctDecode(m[1]), ...coords };
      }
    }

    // Bare coordinates in path: /maps/@lat,lng,zoom
    const coords = extractCoords(path);
    if (coords) return { type: 'place', ...coords };

    // ?q= parameter
    const q = params.get('q');
    if (q) {
      const c = parseAsCoords(q);
      return c ? { type: 'place', ...c } : { type: 'place', query: q };
    }

    // ?ll= parameter
    const ll = params.get('ll');
    if (ll) {
      const c = parseAsCoords(ll);
      if (c) return { type: 'place', ...c };
    }

    return { type: 'unknown' };
  } catch {
    return { type: 'unknown' };
  }
}

// ─── Directions parsers ───────────────────────────────────────────────────────

function parseNewDirectionsFormat(params: URLSearchParams): ParsedGoogleUrl {
  const origin = params.get('origin') ?? '';
  const destination = params.get('destination') ?? '';
  const waypointsRaw = params.get('waypoints') ?? '';
  const travelmode = params.get('travelmode') ?? 'driving';

  const stops = [
    parseLocStr(origin),
    ...waypointsRaw.split('|').filter(Boolean).map(parseLocStr),
    parseLocStr(destination),
  ].filter((s) => s.query || s.lat !== undefined);

  if (stops.length < 2) return { type: 'unknown' };

  return { type: 'directions', stops, travelMode: normalizeTravelMode(travelmode) };
}

function parseOldDirectionsFormat(params: URLSearchParams): ParsedGoogleUrl {
  const stops: Array<{ query?: string; lat?: number; lng?: number }> = [];
  const s = params.get('saddr');
  const d = params.get('daddr');
  if (s) stops.push(parseLocStr(s));
  if (d) stops.push(parseLocStr(d));
  if (stops.length < 2) return { type: 'unknown' };
  return { type: 'directions', stops, travelMode: 'driving' };
}

function parsePathDirections(path: string): ParsedGoogleUrl {
  const m = path.match(/\/maps\/dir\/(.+)/);
  if (!m) return { type: 'unknown' };

  // The section from /@lat,lng,zoom onwards contains navigation metadata.
  // Crucially, the data= blob encodes per-stop coordinates as !1d{lng}!2d{lat} pairs.
  // Extract those coordinates BEFORE stripping the section, so we can attach
  // them to each stop and avoid needing to geocode text-only stop names.
  const stopCoords: Array<{ lat: number; lng: number }> = [];
  const atSection = m[1].match(/@[^/].*/);
  if (atSection) {
    for (const cm of atSection[0].matchAll(/!1d(-?\d+\.?\d+)!2d(-?\d+\.?\d+)/g)) {
      stopCoords.push({ lng: parseFloat(cm[1]), lat: parseFloat(cm[2]) });
    }
  }

  // Strip everything from the @-prefixed segment onwards.
  const stopsSection = m[1].replace(/@[^/].*/, '');

  const rawStops = stopsSection
    .split('/')
    .filter(Boolean)
    .map((p) => parseLocStr(pctDecode(p)));

  // Attach per-stop coordinates if available — this avoids needing a Geocoding
  // API call for stops that are expressed as place names in the URL.
  const stops = rawStops.map((stop, i) =>
    stopCoords[i] ? { ...stop, ...stopCoords[i] } : stop
  );

  if (stops.length < 2) return { type: 'unknown' };
  return { type: 'directions', stops, travelMode: 'driving' };
}

// ─── Place parser ─────────────────────────────────────────────────────────────

function parsePlaceUrl(path: string): ParsedGoogleUrl {
  const m = path.match(/\/maps\/place\/([^/@]+)/);
  const coords = extractCoords(path);
  const query = m ? pctDecode(m[1]) : undefined;
  return { type: 'place', query, ...coords };
}

// ─── Small utilities ──────────────────────────────────────────────────────────

function extractCoords(path: string): { lat: number; lng: number } | undefined {
  const m = path.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : undefined;
}

function parseAsCoords(s: string): { lat: number; lng: number } | undefined {
  const m = s.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : undefined;
}

function parseLocStr(s: string): { query?: string; lat?: number; lng?: number } {
  const s2 = s.trim();
  const coords = parseAsCoords(s2);
  return coords ?? { query: s2 };
}

function pctDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

function normalizeTravelMode(m: string): 'driving' | 'walking' | 'transit' {
  const lower = m.toLowerCase();
  if (lower === 'walking' || lower === 'walk') return 'walking';
  if (lower === 'transit' || lower === 'bus' || lower === 'train') return 'transit';
  return 'driving';
}
