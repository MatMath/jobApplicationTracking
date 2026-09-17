/**
 * Google Maps Platform, from the server and only from the server.
 *
 * One key, never sent to the browser: the address suggestions the form shows
 * come through /api/places/search, and the dashboard map is a Static Maps image
 * fetched by /api/map/applications. A `NEXT_PUBLIC_` key would be simpler but
 * would sit in the bundle for anyone to spend, and it could not be used from
 * here anyway — a browser-restricted key is rejected without a Referer, and the
 * MCP tools have no browser at all. Nothing enforces "server only" beyond the
 * variable's name: an env var without the `NEXT_PUBLIC_` prefix is replaced
 * with undefined in a client bundle, so importing this from a client component
 * breaks the lookup rather than leaking the key.
 *
 * Places API (New) `searchText` does the work of both an autocomplete and a
 * geocoder: it takes half-typed free text and returns a place id, a canonical
 * address, AND coordinates in one response. Using it for the suggestion list as
 * well as for programmatic resolution means the form path and the MCP path run
 * the same code rather than two implementations that drift.
 */

const KEY = process.env.GOOGLE_MAPS_API_KEY;

/** Beyond this, a lookup is treated as failed rather than left to hang a save. */
const TIMEOUT_MS = 6000;

export type Place = {
  placeId: string;
  /** Google's canonical one-line address, e.g. "490 Rue ..., Montréal, QC ...". */
  address: string;
  /** The place's own name when it has one ("Shopify"), else null. */
  name: string | null;
  lat: number;
  lng: number;
};

/** False when no key is configured; every caller degrades rather than erroring. */
export function placesConfigured(): boolean {
  return Boolean(KEY);
}

type PlaceResponse = {
  id?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
};

/** Drops anything missing the three fields that make a place useful to us. */
function toPlace(raw: PlaceResponse): Place | null {
  const { id, formattedAddress, location } = raw;
  if (!id || !formattedAddress) return null;
  if (typeof location?.latitude !== 'number' || typeof location?.longitude !== 'number') {
    return null;
  }
  return {
    placeId: id,
    address: formattedAddress,
    name: raw.displayName?.text ?? null,
    lat: location.latitude,
    lng: location.longitude,
  };
}

const FIELDS = 'id,formattedAddress,displayName,location';

/**
 * Candidate offices for a free-text query, best match first.
 *
 * Throws on a configuration or transport problem so the caller can say why the
 * list is empty — an empty array here means Google found nothing, which is a
 * different answer and deserves different words.
 */
export async function searchPlaces(query: string, limit = 5): Promise<Place[]> {
  if (!KEY) throw new Error('GOOGLE_MAPS_API_KEY is not set.');

  const trimmed = query.trim();
  if (!trimmed) return [];

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': FIELDS.split(',').map((f) => `places.${f}`).join(','),
    },
    body: JSON.stringify({ textQuery: trimmed, maxResultCount: Math.min(limit, 10) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Places search failed (${response.status}): ${await errorDetail(response)}`);
  }

  const body = (await response.json()) as { places?: PlaceResponse[] };
  return (body.places ?? []).map(toPlace).filter((p): p is Place => p !== null);
}

/**
 * One place by id. The form sends the id of the suggestion that was picked and
 * the coordinates are read back here rather than trusted from the client: a
 * form field is user input, and lat/lng written straight from it would put a
 * marker wherever the submitter liked.
 */
export async function placeById(placeId: string): Promise<Place | null> {
  if (!KEY) throw new Error('GOOGLE_MAPS_API_KEY is not set.');

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': FIELDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Place lookup failed (${response.status}): ${await errorDetail(response)}`);
  }

  return toPlace((await response.json()) as PlaceResponse);
}

/**
 * Resolves whatever a caller has — a picked place id, or just typed text — to
 * coordinates. Never throws: a geocode is an enrichment, and Google being slow
 * or down must not cost someone the application they just typed out. A failure
 * leaves the address stored as text with no pin, which the next edit retries.
 */
export async function resolveLocation(
  location: string | null,
  placeId: string | null,
): Promise<Place | null> {
  if (!KEY) return null;
  if (!location && !placeId) return null;

  try {
    // An explicitly chosen place wins: someone picked it from the suggestions,
    // so it is a real place whatever the text next to it says.
    if (placeId) {
      const exact = await placeById(placeId);
      if (exact) return exact;
    }
    if (!location || isPlaceholderLocation(location)) return null;
    const [best] = await searchPlaces(location, 1);
    return best ?? null;
  } catch (error) {
    // Logged, not surfaced: the write it belongs to is still going through.
    console.warn('[geo] could not resolve location', { location, placeId, error });
    return null;
  }
}

/**
 * Things people write in a location field that are not places.
 *
 * Google will answer almost anything. "Remote" comes back as a holiday villa in
 * Greece that advertises good wifi, and "Anywhere" as a tour operator in Costa
 * Rica — both with real coordinates and full confidence. Pinning those puts an
 * application on the map somewhere it has never been, which is worse than
 * leaving it off, so the automatic path refuses them before asking.
 */
const NOT_A_PLACE = new Set([
  'remote',
  'remote work',
  'fully remote',
  '100% remote',
  'anywhere',
  'anywhere in canada',
  'work from home',
  'wfh',
  'home office',
  'telecommute',
  'virtual',
  'distributed',
  'worldwide',
  'global',
  'various',
  'various locations',
  'multiple locations',
  'n/a',
  'na',
  'tbd',
  'unknown',
  'flexible',
]);

/**
 * Only an exact match counts, so "Montreal (remote)" still finds Montreal —
 * the word appearing next to a real place is not the problem.
 */
export function isPlaceholderLocation(location: string): boolean {
  const normalized = location
    .toLowerCase()
    .replace(/[.,!–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return NOT_A_PLACE.has(normalized);
}

export type MapMarker = { lat: number; lng: number; label?: string };

/**
 * A Static Maps URL. It carries the key, so it is only ever fetched server-side
 * — see /api/map/applications, which returns the image bytes instead of the URL.
 *
 * No center and no zoom on purpose: given markers alone, Google frames them,
 * which is exactly "fit every place I have applied to" and is not something
 * worth reimplementing with bounding-box maths.
 */
export function staticMapUrl(
  markers: MapMarker[],
  { width = 640, height = 360, scale = 2 } = {},
): string | null {
  if (!KEY || markers.length === 0) return null;

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    scale: String(scale),
    maptype: 'roadmap',
    key: KEY,
  });

  // One `markers` parameter per pin so each can carry its own label; repeated
  // keys are how the Static Maps API expects this.
  for (const marker of markers) {
    const coords = `${marker.lat.toFixed(6)},${marker.lng.toFixed(6)}`;
    // Labels are a single uppercase letter or digit; anything else is dropped
    // by Google, so a pin past the alphabet is simply unlabelled.
    const label = marker.label && /^[A-Z0-9]$/.test(marker.label) ? `label:${marker.label}|` : '';
    params.append('markers', `color:0x2563eb|${label}${coords}`);
  }

  // A single pin has nothing to frame against, so ask for a city-level view.
  if (markers.length === 1) params.set('zoom', '11');

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** Google's error bodies are JSON; this keeps the useful line out of a wall of it. */
async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? 'no detail';
  } catch {
    return 'no detail';
  }
}
