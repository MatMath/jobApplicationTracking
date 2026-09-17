import { createClient, getUser } from '@/lib/supabase/server';
import { staticMapUrl } from '@/lib/geo/places';
import { loadOfficePins } from '@/lib/geo/pins';

/**
 * The dashboard map, as a PNG.
 *
 * The image is fetched here and re-served rather than pointed at from an <img
 * src>, because a Static Maps URL carries the API key: putting it in the markup
 * would publish the key to anyone who opens the page source, which is the one
 * thing keeping it out of the bundle was meant to avoid.
 *
 * It takes no parameters. The pins come from the caller's own applications, so
 * there is no way to ask this endpoint for an arbitrary map of somewhere else
 * on the project's dime.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getUser();
  if (!user) return new Response('Not signed in.', { status: 401 });

  const supabase = await createClient();
  const pins = await loadOfficePins(supabase, user.id);

  const url = staticMapUrl(
    pins.map((p) => ({ lat: p.lat, lng: p.lng, label: p.label ?? undefined })),
    { width: 640, height: 360 },
  );
  // No key, or nothing placed yet. The page renders its own explanation, so
  // this only has to be an image that will not render.
  if (!url) return new Response('No map to draw.', { status: 404 });

  const image = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!image?.ok) {
    console.warn('[map] static map request failed', image?.status);
    return new Response('Map unavailable.', { status: 502 });
  }

  return new Response(image.body, {
    headers: {
      'Content-Type': image.headers.get('content-type') ?? 'image/png',
      // Private: it is a picture of one person's job search. Five minutes is
      // long enough that a reload is free and short enough that a new
      // application shows up while you are still looking for it.
      'Cache-Control': 'private, max-age=300',
    },
  });
}
