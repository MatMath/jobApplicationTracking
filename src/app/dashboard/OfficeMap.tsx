import Link from 'next/link';
import type { OfficePin } from '@/lib/geo/pins';

/**
 * Where the applications are, as a map plus the same thing as a list.
 *
 * The image comes from /api/map/applications rather than from a Google URL in
 * the markup, because that URL carries the API key. A static image also cannot
 * be clicked, which is why the list beside it is not a fallback but half the
 * feature: it is where a pin turns back into the application it came from —
 * the same reasoning as the "Show as table" panel under every chart here.
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

  return (
    <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
      {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-user
          endpoint, not an optimizable static asset. */}
      <img
        src="/api/map/applications"
        width={640}
        height={360}
        alt={`Map of ${pins.length} office location${pins.length === 1 ? '' : 's'}, labelled A onwards. The same places are listed beside it.`}
        className="w-full rounded border border-black/10 dark:border-white/10"
      />

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
      </p>
    </div>
  );
}
