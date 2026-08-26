import { logoUrl } from '@/lib/logo';

/**
 * Plain <img> rather than next/image: these are already CDN-optimised, sized in
 * the URL, and routing them through the Next optimiser would add a hop and a
 * remotePatterns entry for no benefit.
 */
export function CompanyLogo({
  company,
  size = 32,
}: {
  company: { name: string; website?: string | null };
  size?: number;
}) {
  const src = logoUrl(company, size * 2);

  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        aria-hidden
        className="shrink-0 rounded bg-black/10 dark:bg-white/10"
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
      className="shrink-0 rounded bg-white/5 object-contain"
    />
  );
}
