/**
 * Puts map pins on applications recorded before addresses were geocoded.
 *
 *   npm run geo:backfill            # resolve every located-but-unpinned row
 *   npm run geo:backfill -- --dry   # show what would be looked up, spend nothing
 *
 * One-off maintenance, not part of the app. It runs on SUPABASE_SECRET_KEY,
 * which bypasses RLS, so it touches every user's rows and must never be
 * reachable from a request. Everything written after this is geocoded on the
 * way in by lib/applications/write.ts.
 *
 * Over the REST API rather than DATABASE_URL on purpose: the direct Postgres
 * host is IPv6-only, so a machine without an IPv6 route cannot reach it, and a
 * maintenance script that fails to connect is a maintenance script nobody runs.
 *
 * Each row costs one Places lookup, so the run is serial and stops at a limit
 * rather than discovering a thousand rows and billing for all of them at once.
 */
import { createClient } from '@supabase/supabase-js';
import { placesConfigured, resolveLocation } from '../../src/lib/geo/places';

const dryRun = process.argv.includes('--dry');
const LIMIT = Number(process.env.GEO_BACKFILL_LIMIT ?? 200);

async function main() {
  if (!placesConfigured()) {
    console.error('GOOGLE_MAPS_API_KEY is not set — nothing to look up with.');
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must both be set.');
    process.exit(1);
  }

  const db = createClient(url, key);

  const { data: rows, error } = await db
    .from('applications')
    .select('id, location, location_place_id')
    .not('location', 'is', null)
    .is('location_lat', null)
    .limit(LIMIT);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`${rows.length} application(s) with an address and no pin.`);

  let pinned = 0;
  for (const row of rows) {
    if (dryRun) {
      console.log(`  would look up: ${row.location}`);
      continue;
    }

    const place = await resolveLocation(row.location, row.location_place_id);
    if (!place) {
      console.log(`  unresolved: ${row.location}`);
      continue;
    }

    const { error: writeError } = await db
      .from('applications')
      .update({
        location_place_id: place.placeId,
        location_lat: place.lat,
        location_lng: place.lng,
      })
      .eq('id', row.id);

    if (writeError) {
      console.log(`  failed to write ${row.location}: ${writeError.message}`);
      continue;
    }

    pinned += 1;
    console.log(`  ${row.location} -> ${place.address} (${place.lat}, ${place.lng})`);
  }

  console.log(dryRun ? 'Dry run: nothing written.' : `Pinned ${pinned} of ${rows.length}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
