import { describe, expect, it } from 'vitest';
import { groupPins } from './pins';

/**
 * The grouping is what makes the map legible, and it runs twice per page view —
 * once for the image, once for the list. These two have to agree on which pin
 * is "B", so the labelling is pinned down here rather than eyeballed.
 */

const row = (over: Partial<Parameters<typeof groupPins>[0][number]> = {}) => ({
  id: 'a1',
  role: 'Engineer',
  location: 'Montreal',
  location_lat: 45.5,
  location_lng: -73.56,
  companies: { name: 'Shopify' },
  ...over,
});

describe('groupPins', () => {
  it('labels places A, B, C in the order they arrive', () => {
    const pins = groupPins([
      row({ id: '1', location_lat: 45.5, location_lng: -73.56 }),
      row({ id: '2', location: 'Toronto', location_lat: 43.65, location_lng: -79.38 }),
    ]);

    expect(pins.map((p) => p.label)).toEqual(['A', 'B']);
    expect(pins[1].address).toBe('Toronto');
  });

  it('collapses two applications at the same building into one pin', () => {
    const pins = groupPins([
      row({ id: '1', role: 'Senior Engineer' }),
      // ~20m away: the same office entered as a street address rather than a city.
      row({ id: '2', role: 'Staff Engineer', location_lat: 45.5001, location_lng: -73.5601 }),
    ]);

    expect(pins).toHaveLength(1);
    expect(pins[0].applications.map((a) => a.role)).toEqual([
      'Senior Engineer',
      'Staff Engineer',
    ]);
  });

  it('keeps offices in different parts of a city apart', () => {
    const pins = groupPins([
      row({ id: '1' }),
      row({ id: '2', location_lat: 45.52, location_lng: -73.6 }),
    ]);

    expect(pins).toHaveLength(2);
  });

  it('drops rows with no coordinates rather than pinning them at null island', () => {
    const pins = groupPins([row({ id: '1', location_lat: null, location_lng: null })]);
    expect(pins).toEqual([]);
  });

  it('leaves pins past Z unlabelled, since Static Maps would drop the label', () => {
    const many = Array.from({ length: 27 }, (_, i) =>
      row({ id: String(i), location_lat: 45 + i * 0.1 }),
    );

    const pins = groupPins(many);
    expect(pins[25].label).toBe('Z');
    expect(pins[26].label).toBeNull();
  });

  it('reads the company through PostgREST\'s array-shaped join', () => {
    const pins = groupPins([row({ companies: [{ name: 'Lightspeed' }] })]);
    expect(pins[0].applications[0].company).toBe('Lightspeed');
  });
});
