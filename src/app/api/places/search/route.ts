import { getUser } from '@/lib/supabase/server';
import { placesConfigured, searchPlaces } from '@/lib/geo/places';

/**
 * Address suggestions for the location field.
 *
 * The browser asks this instead of Google directly, which is the whole reason
 * the key can stay server-side. That makes this endpoint a way to spend the
 * project's Places quota, so it is closed to anyone not signed in — a public
 * proxy to a metered API is somebody else's free geocoder.
 *
 * Coordinates are deliberately not returned. The write path looks the place up
 * again by id when it saves, so there is nothing to gain by shipping lat/lng to
 * a client that cannot be trusted to send them back unchanged.
 */

export const dynamic = 'force-dynamic';

/** Below this, suggestions are noise and every keystroke is a billed call. */
const MIN_QUERY = 3;

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Not signed in.' }, { status: 401 });
  }

  if (!placesConfigured()) {
    // Not an error: the form falls back to a plain text box, which still saves.
    return Response.json({ places: [], configured: false });
  }

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < MIN_QUERY) {
    return Response.json({ places: [], configured: true });
  }

  try {
    const places = await searchPlaces(query);
    return Response.json({
      configured: true,
      places: places.map((p) => ({ placeId: p.placeId, address: p.address, name: p.name })),
    });
  } catch (error) {
    console.warn('[places] search failed', error);
    return Response.json({ error: 'Address lookup is unavailable.' }, { status: 502 });
  }
}
