import Link from 'next/link';
import type { OfficePin } from '@/lib/geo/pins';
import { ApplicationMap } from './ApplicationMap';

/**
 * Where the applications are, as a map plus the same thing as a list.
 *
 * The map pans and zooms when a browser key is configured, and falls back to a
 * still image from /api/map/applications when one is not — that endpoint exists
 * because a Static Maps URL carries the server key, which must not appear in
 * the markup. See ApplicationMap for why the two keys are different.
 *
 * The list is not a fallback but half the feature. It is the only part that
 * works with JavaScript off, the part a screen reader can use, and the part
 * that stays readable when four pins sit on the same city — the same reasoning
 * as the "Show as table" panel under every chart on this page.
 */
export function OfficeMap({ pins, configured }: { pins: OfficePin[]; configured: boolean }) {
  if (pins.length === 0) {
    return (
      <p className="text-sm opacity-60">
        {configured
          ? 'No application has an office address yet. Add one to an application and it appears here.'
          : 'Set GOOGLE_MAPS_API_KEY to turn office addresses into map pins. Addresses already recorded are picked up the next time each application is saved.'}
      </p>
    );
  }

  const total = pins.reduce((sum, p) => sum + p.applications.length, 0);
  // Read on the server and passed down, so the client component never has to
  // decide whether it can run.
  const interactive = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);

  return (
    <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
      {interactive ? (
        <ApplicationMap pins={pins} />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- a private,
           per-user endpoint, not an optimizable static asset. */
        <img
          src="/api/map/applications"
          width={640}
          height={360}
          alt={`Map of ${pins.length} office location${pins.length === 1 ? '' : 's'}, labelled A onwards. The same places are listed beside it.`}
          className="w-full rounded border border-black/10 dark:border-white/10"
        />
      )}

      <ol className="flex flex-col gap-3 text-sm">
        {pins.map((pin) => (
          <li key={`${pin.lat},${pin.lng}`} className="flex gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--series-1)] text-[11px] font-medium text-white"
            >
              {pin.label ?? '•'}
            </span>
            <div>
              <div className="opacity-70">{pin.address}</div>
              <ul className="mt-1">
                {pin.applications.map((a) => (
                  <li key={a.id}>
                    <Link href={`/applications/${a.id}`} className="underline underline-offset-2">
                      {a.role}
                    </Link>
                    {a.company ? <span className="opacity-50"> · {a.company}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs opacity-50 md:col-span-2">
        {total} application{total === 1 ? '' : 's'} across {pins.length} location
        {pins.length === 1 ? '' : 's'}. Applications with no address recorded are not shown.
        {interactive ? ' Drag to pan, scroll with ctrl or ⌘ held to zoom.' : null}
      </p>
    </div>
  );
}
