import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The offices behind the dashboard map.
 *
 * The map image and the list beside it are produced by two different requests —
 * a page render and an <img> fetch — and they have to agree on which pin is
 * "B". So the grouping and the labelling happen here, once, and both callers
 * read the same answer.
 */

export type OfficePin = {
  /** The marker's letter, or null past Z, where Static Maps drops labels. */
  label: string | null;
  lat: number;
  lng: number;
  address: string;
  applications: { id: string; role: string; company: string | null }[];
};

type LocatedRow = {
  id: string;
  role: string;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  companies: { name: string } | { name: string }[] | null;
};

/**
 * Three decimals is about 100m. Anything closer than that is the same building
 * from two spellings ("Shopify Montreal" and its street address), and two pins
 * on top of each other read as one pin that cannot be clicked.
 */
const PRECISION = 3;

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export async function loadOfficePins(
  supabase: SupabaseClient,
  userId: string,
): Promise<OfficePin[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('id, role, location, location_lat, location_lng, companies (name)')
    .eq('user_id', userId)
    .not('location_lat', 'is', null)
    .not('location_lng', 'is', null)
    // Oldest first, so an existing pin keeps its letter when a new one appears.
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return groupPins(data as unknown as LocatedRow[]);
}

/** Exported for its own sake: this is the part worth testing without a database. */
export function groupPins(rows: LocatedRow[]): OfficePin[] {
  const byPlace = new Map<string, OfficePin>();

  for (const row of rows) {
    const { location_lat: lat, location_lng: lng } = row;
    if (lat === null || lng === null) continue;

    const key = `${lat.toFixed(PRECISION)},${lng.toFixed(PRECISION)}`;
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    const existing = byPlace.get(key);

    if (existing) {
      existing.applications.push({ id: row.id, role: row.role, company: company?.name ?? null });
      continue;
    }

    byPlace.set(key, {
      label: null, // assigned below, once the order is settled
      lat,
      lng,
      address: row.location ?? 'Unnamed location',
      applications: [{ id: row.id, role: row.role, company: company?.name ?? null }],
    });
  }

  return [...byPlace.values()].map((pin, i) => ({
    ...pin,
    label: i < LABELS.length ? LABELS[i] : null,
  }));
}
