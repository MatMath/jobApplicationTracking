'use client';

import { useEffect, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import type { OfficePin } from '@/lib/geo/pins';

/**
 * The dashboard map, pannable and zoomable.
 *
 * This is the one place a Google key reaches the browser, and it is a different
 * key from the one everything else uses: `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
 * is restricted to the Maps JavaScript API and to this app's own domains, so
 * the worst it can do if scraped is draw a map. `GOOGLE_MAPS_API_KEY`, which
 * can spend Places quota on geocoding, stays on the server where it always was.
 *
 * The static image from /api/map/applications is still here, as the placeholder
 * while the library loads and as the fallback if it never does — an ad blocker,
 * a referrer the key does not allow, or an exhausted quota all end with a map
 * on the page rather than a hole in the layout.
 */

/** Same blue as the static map's markers and the list's letter badges. */
const PIN = '#2563eb';

/** A map pin, drawn rather than fetched so it can carry the palette's blue. */
const PIN_PATH =
  'M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9z';

export function ApplicationMap({ pins }: { pins: OfficePin[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // React runs effects twice in development; a cancelled run must not leave a
    // second map attached to the same node.
    let cancelled = false;

    async function draw() {
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
      if (!key || !container.current || pins.length === 0) return;

      try {
        setOptions({ key, v: 'weekly' });
        const [{ Map, InfoWindow }, { Marker }] = await Promise.all([
          importLibrary('maps'),
          importLibrary('marker'),
        ]);
        if (cancelled || !container.current) return;

        const map = new Map(container.current, {
          mapTypeControl: false, // a satellite view of an office tells you nothing
          // Rotate and tilt are for looking at terrain, not for finding which
          // city a job is in, and the cluster crowds a map this size.
          cameraControl: false,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          // Scrolling the page over the map scrolls the page; zooming takes
          // ctrl or ⌘. 'greedy' would swallow a scroll aimed past the map.
          gestureHandling: 'cooperative',
          // Matches the app's own light/dark rather than always being light.
          colorScheme: 'FOLLOW_SYSTEM',
        });

        const info = new InfoWindow();
        const bounds = new google.maps.LatLngBounds();

        for (const pin of pins) {
          const position = { lat: pin.lat, lng: pin.lng };
          bounds.extend(position);

          // google.maps.Marker rather than AdvancedMarkerElement: the latter
          // needs a Map ID created in the Cloud console, which is a manual step
          // this app would otherwise not have. Swap it in if one ever exists.
          const marker = new Marker({
            map,
            position,
            title: pin.address,
            label: pin.label
              ? { text: pin.label, color: 'white', fontSize: '12px', fontWeight: '600' }
              : undefined,
            icon: {
              path: PIN_PATH,
              fillColor: PIN,
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 1.5,
              scale: 1.5,
              // The tip sits on the coordinate; the letter rides in the head.
              anchor: new google.maps.Point(12, 24),
              labelOrigin: new google.maps.Point(12, 9),
            },
          });

          marker.addListener('click', () => {
            info.setContent(bubble(pin));
            info.open({ map, anchor: marker });
          });
        }

        map.fitBounds(bounds, 48);
        // fitBounds on a single point zooms to the maximum, which lands inside
        // a building with no context around it.
        if (pins.length === 1) {
          google.maps.event.addListenerOnce(map, 'idle', () => map.setZoom(12));
        }

        setReady(true);
      } catch {
        // Keeps the static image up rather than replacing it with an error.
        if (!cancelled) setFailed(true);
      }
    }

    void draw();
    return () => {
      cancelled = true;
    };
  }, [pins]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded border border-black/10 dark:border-white/10">
      <div ref={container} className="absolute inset-0" />

      {!ready ? (
        // eslint-disable-next-line @next/next/no-img-element -- a private,
        // per-user endpoint, not an optimizable static asset.
        <img
          src="/api/map/applications"
          alt={`Map of ${pins.length} office location${pins.length === 1 ? '' : 's'}, labelled A onwards. The same places are listed beside it.`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {failed ? (
        <p className="absolute bottom-0 left-0 right-0 bg-[var(--background)]/90 px-3 py-1.5 text-xs opacity-70">
          Showing a still map — the interactive one could not load.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The popup for one pin. Built as a DOM node rather than an HTML string so the
 * addresses and role titles cannot be read as markup — they are whatever was
 * typed into a form or returned by a lookup, which is not to be trusted as HTML.
 */
function bubble(pin: OfficePin): HTMLElement {
  const root = document.createElement('div');
  root.style.maxWidth = '220px';
  root.style.color = '#1f2937';

  const address = document.createElement('p');
  address.textContent = pin.address;
  address.style.cssText = 'margin:0 0 6px;font-size:12px;opacity:.7';
  root.append(address);

  const list = document.createElement('ul');
  list.style.cssText = 'margin:0;padding:0;list-style:none;font-size:13px';

  for (const application of pin.applications) {
    const item = document.createElement('li');
    item.style.marginTop = '2px';

    const link = document.createElement('a');
    link.href = `/applications/${application.id}`;
    link.textContent = application.role;
    link.style.cssText = `color:${PIN};text-decoration:underline`;
    item.append(link);

    if (application.company) {
      const company = document.createElement('span');
      company.textContent = ` · ${application.company}`;
      company.style.opacity = '.6';
      item.append(company);
    }

    list.append(item);
  }

  root.append(list);
  return root;
}
