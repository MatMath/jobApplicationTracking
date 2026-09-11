type HeaderSource = { get(name: string): string | null };

/**
 * The origin the browser is actually on, for building absolute URLs.
 *
 * Next's standalone server derives request.nextUrl from its own bind address,
 * so behind Cloud Run it reports https://localhost:8080. Any redirect built
 * from it sends users to localhost. Next leaves a Location alone when its
 * origin differs from that internal one, so writing the real public origin
 * ourselves is what makes redirects correct in production.
 *
 * NEXT_PUBLIC_SITE_URL wins when set: explicit config beats headers. Otherwise
 * the forwarded headers, which Cloud Run sets and which cannot be forged there -
 * its front end routes by Host, so a request with someone else's Host never
 * reaches this service.
 */
export function publicOrigin(headers: HeaderSource): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const first = (v: string | null) => v?.split(',')[0]?.trim() || null;
  const host = first(headers.get('x-forwarded-host')) ?? first(headers.get('host')) ?? 'localhost:3000';
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const proto = first(headers.get('x-forwarded-proto')) ?? (local ? 'http' : 'https');
  return `${proto}://${host}`;
}
