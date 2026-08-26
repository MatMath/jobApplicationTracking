const TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

/**
 * Reduces whatever was typed into the website field to a bare hostname.
 * Accepts "https://www.shopify.com/careers", "shopify.com", "www.shopify.com".
 */
export function toDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  const trimmed = website.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const host = new URL(withProtocol).hostname.replace(/^www\./i, '');
    // A hostname with no dot is not a domain, it is someone's typo.
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}

/**
 * Logo.dev image URL for a company.
 *
 * Prefers the domain, which is unambiguous. Falls back to the `name/` lookup so
 * a company with no website recorded still gets a logo rather than a gap — and
 * failing that, logo.dev returns a generated monogram with 200 OK, so the img
 * never breaks and needs no onError handling.
 */
export function logoUrl(
  company: { name: string; website?: string | null },
  size = 64,
): string | null {
  if (!TOKEN) return null;

  const domain = toDomain(company.website);
  const path = domain ?? `name/${encodeURIComponent(company.name)}`;
  const params = new URLSearchParams({
    token: TOKEN,
    size: String(size),
    format: 'webp',
    retina: 'true',
  });
  return `https://img.logo.dev/${path}?${params.toString()}`;
}
