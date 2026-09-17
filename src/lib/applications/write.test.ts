import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const resolveLocation = vi.fn();
vi.mock('@/lib/geo/places', () => ({ resolveLocation: (...args: unknown[]) => resolveLocation(...args) }));

const { setLocation } = await import('./write');

/**
 * "The pin follows the address" is the rule the map depends on, and the one
 * cheapest to break: every path that writes an address has to re-geocode when
 * it changes and leave Google alone when it does not. These drive that through
 * setLocation, the narrowest caller, with a stub standing in for Postgres.
 */

const ID = '00000000-0000-4000-8000-000000000000';
const MONTREAL = {
  placeId: 'ChIJ-montreal',
  address: '490 Rue De la Gauchetière O, Montréal, QC, Canada',
  name: 'Shopify',
  lat: 45.5026327,
  lng: -73.5638074,
};

/** Just enough of the client: one row to read back, one update to capture. */
function fakeSupabase(current: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: current, error: null }) }) }),
      }),
      update: (values: Record<string, unknown>) => {
        updates.push(values);
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
    }),
  } as unknown as SupabaseClient;

  return { client, updates };
}

const stored = (over: Record<string, unknown> = {}) => ({
  status: 'applied',
  first_response_at: null,
  closed_at: null,
  applied_at: '2026-01-01T00:00:00Z',
  location: 'Montreal, QC',
  location_place_id: 'ChIJ-old',
  location_lat: 45.5,
  location_lng: -73.56,
  ...over,
});

beforeEach(() => resolveLocation.mockReset());

describe('setLocation', () => {
  it('moves the pin when the address changes', async () => {
    resolveLocation.mockResolvedValue(MONTREAL);
    const { client, updates } = fakeSupabase(stored());

    const result = await setLocation(client, 'user-1', {
      id: ID,
      location: 'Shopify Montreal',
      locationPlaceId: MONTREAL.placeId,
    });

    expect(result.error).toBeNull();
    expect(updates[0]).toEqual({
      location: 'Shopify Montreal',
      location_place_id: MONTREAL.placeId,
      location_lat: MONTREAL.lat,
      location_lng: MONTREAL.lng,
    });
  });

  it('does not spend a lookup when the address is unchanged and already pinned', async () => {
    const { client, updates } = fakeSupabase(stored());

    await setLocation(client, 'user-1', {
      id: ID,
      location: 'Montreal, QC',
      locationPlaceId: 'ChIJ-old',
    });

    expect(resolveLocation).not.toHaveBeenCalled();
    // Only the four location columns — never the lifecycle fields read alongside them.
    expect(Object.keys(updates[0]).sort()).toEqual([
      'location',
      'location_lat',
      'location_lng',
      'location_place_id',
    ]);
  });

  it('retries an address that was stored without coordinates', async () => {
    resolveLocation.mockResolvedValue(MONTREAL);
    const { client } = fakeSupabase(stored({ location_lat: null, location_lng: null }));

    await setLocation(client, 'user-1', { id: ID, location: 'Montreal, QC', locationPlaceId: 'ChIJ-old' });

    expect(resolveLocation).toHaveBeenCalledOnce();
  });

  it('clears stale coordinates when the new address cannot be resolved', async () => {
    resolveLocation.mockResolvedValue(null);
    const { client, updates } = fakeSupabase(stored());

    await setLocation(client, 'user-1', { id: ID, location: 'Somewhere unmappable', locationPlaceId: null });

    // The old pin pointed at Montreal; keeping it against a different address
    // would put the application on the map in a place it is not.
    expect(updates[0]).toEqual({
      location: 'Somewhere unmappable',
      location_place_id: null,
      location_lat: null,
      location_lng: null,
    });
  });

  it('takes Google\'s address when given only a place id', async () => {
    resolveLocation.mockResolvedValue(MONTREAL);
    const { client, updates } = fakeSupabase(stored());

    await setLocation(client, 'user-1', { id: ID, location: null, locationPlaceId: MONTREAL.placeId });

    expect(updates[0].location).toBe(MONTREAL.address);
  });
});
