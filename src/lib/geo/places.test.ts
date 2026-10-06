import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Static Maps URL. Nothing downstream can tell a mis-built one from a
 * correct one — Google answers a bad marker string with a plausible-looking map
 * of the wrong thing — so the parameters are asserted here.
 *
 * The key is read when the module loads, so each test imports a fresh copy with
 * the environment it wants.
 */
async function load(key: string | undefined) {
  vi.resetModules();
  if (key === undefined) vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
  else vi.stubEnv('GOOGLE_MAPS_API_KEY', key);
  return import('./places');
}

beforeEach(() => vi.stubEnv('GOOGLE_MAPS_API_KEY', ''));
afterEach(() => vi.unstubAllEnvs());

describe('staticMapUrl', () => {
  it('gives one labelled marker parameter per pin', async () => {
    const { staticMapUrl } = await load('test-key');
    const url = new URL(
      staticMapUrl([
        { lat: 45.5026327, lng: -73.5638074, label: 'A' },
        { lat: 43.6532, lng: -79.3832, label: 'B' },
      ])!,
    );

    const markers = url.searchParams.getAll('markers');
    expect(markers).toEqual([
      'color:0x2563eb|label:A|45.502633,-73.563807',
      'color:0x2563eb|label:B|43.653200,-79.383200',
    ]);
    // No centre and no zoom: Google frames the markers, which is the point.
    expect(url.searchParams.get('center')).toBeNull();
    expect(url.searchParams.get('zoom')).toBeNull();
  });

  it('zooms in on a single pin, which has nothing to be framed against', async () => {
    const { staticMapUrl } = await load('test-key');
    const url = new URL(staticMapUrl([{ lat: 45.5, lng: -73.56, label: 'A' }])!);
    expect(url.searchParams.get('zoom')).toBe('11');
  });

  it('drops a label Static Maps would reject rather than sending it', async () => {
    const { staticMapUrl } = await load('test-key');
    const url = new URL(staticMapUrl([{ lat: 45.5, lng: -73.56, label: 'AB' }])!);
    expect(url.searchParams.get('markers')).toBe('color:0x2563eb|45.500000,-73.560000');
  });

  it('returns null with no key or no pins, so callers can explain themselves', async () => {
    const withKey = await load('test-key');
    expect(withKey.staticMapUrl([])).toBeNull();
    expect(withKey.placesConfigured()).toBe(true);

    const without = await load(undefined);
    expect(without.staticMapUrl([{ lat: 45.5, lng: -73.56 }])).toBeNull();
    expect(without.placesConfigured()).toBe(false);
  });

  it('never resolves a location without a key instead of throwing into a save', async () => {
    const { resolveLocation } = await load(undefined);
    await expect(resolveLocation('Montreal', null)).resolves.toBeNull();
  });
});

describe('isPlaceholderLocation', () => {
  it('refuses the words people write when there is no office', async () => {
    const { isPlaceholderLocation } = await load('test-key');
    for (const text of ['Remote', 'remote', '  REMOTE  ', 'Fully remote', 'Anywhere', 'work from home', 'WFH', 'N/A', 'TBD', 'Various locations']) {
      expect(isPlaceholderLocation(text), text).toBe(true);
    }
  });

  it('leaves a real place alone even when the word appears beside it', async () => {
    const { isPlaceholderLocation } = await load('test-key');
    for (const text of ['Montreal (remote)', 'Remote - Montreal, QC', 'Toronto, ON', 'Remote Way, Austin']) {
      expect(isPlaceholderLocation(text), text).toBe(false);
    }
  });

  it('never geocodes a placeholder, so no pin lands in the wrong country', async () => {
    const { resolveLocation } = await load('test-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(resolveLocation('Remote', null)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('looks up the region a remote posting names, not the word "Remote"', async () => {
    const { withoutRemoteQualifier } = await load('test-key');
    expect(withoutRemoteQualifier('Remote - United States')).toBe('United States');
    expect(withoutRemoteQualifier('Remote (Canada)')).toBe('Canada');
    expect(withoutRemoteQualifier('Fully remote in Quebec')).toBe('Quebec');
    expect(withoutRemoteQualifier('Remote, Montreal, QC')).toBe('Montreal, QC');
    expect(withoutRemoteQualifier('Montreal (remote)')).toBe('Montreal');
    expect(withoutRemoteQualifier('Toronto, ON - Remote')).toBe('Toronto, ON');
    // Not a qualifier: a street, and the bare word.
    expect(withoutRemoteQualifier('Remote Way, Austin')).toBe('Remote Way, Austin');
    expect(withoutRemoteQualifier('Remote')).toBe('Remote');
  });

  it('gives a country or a province no pin, and a city one', async () => {
    const { resolveLocation } = await load('test-key');
    const answer = (types: string[]) =>
      new Response(
        JSON.stringify({
          places: [{ id: 'p1', formattedAddress: 'Somewhere', location: { latitude: 39.8, longitude: -98.6 }, types }],
        }),
      );
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockResolvedValueOnce(answer(['country', 'political']));
    await expect(resolveLocation('Remote - United States', null)).resolves.toBeNull();
    // Asked about the country, not about a business with "Remote" in its name.
    expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string).textQuery).toBe('United States');

    fetchSpy.mockResolvedValueOnce(answer(['administrative_area_level_1', 'political']));
    await expect(resolveLocation('Ontario', null)).resolves.toBeNull();

    fetchSpy.mockResolvedValueOnce(answer(['locality', 'political']));
    await expect(resolveLocation('Remote - Montreal, QC', null)).resolves.toMatchObject({ placeId: 'p1' });

    fetchSpy.mockRestore();
  });

  it('refuses a region by its size when its type does not give it away', async () => {
    const { isTooBroadToPin, resolveLocation } = await load('test-key');
    // "Americas" and "Bay Area" are both a colloquial_area; only one is a place to work.
    expect(isTooBroadToPin({ types: ['colloquial_area', 'political'], spanDegrees: 167.5 })).toBe(true);
    expect(isTooBroadToPin({ types: ['colloquial_area', 'political'], spanDegrees: 2.4 })).toBe(false);
    expect(isTooBroadToPin({ types: ['locality'], spanDegrees: null })).toBe(false);

    // The frame Google returns for the Americas crosses the antimeridian.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          places: [
            {
              id: 'p1',
              formattedAddress: 'Americas',
              location: { latitude: 54.5, longitude: -105.3 },
              types: ['colloquial_area', 'political'],
              viewport: { low: { latitude: -60, longitude: 172.5 }, high: { latitude: 83.5, longitude: -20 } },
            },
          ],
        }),
      ),
    );
    await expect(resolveLocation('Remote - Americas', null)).resolves.toBeNull();
    fetchSpy.mockRestore();
  });
});
