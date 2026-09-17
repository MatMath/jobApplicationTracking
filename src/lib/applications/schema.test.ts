import { describe, expect, it } from 'vitest';
import { applicationInput, applicationUpdateInput, locationChangeInput } from './schema';

/**
 * The office-location rule, from both ends. It is the one validation in here
 * that depends on two fields at once, so it is also the one an unrelated edit
 * to the field list could quietly drop — extending a refined schema is exactly
 * how that happens, which is why the update shape is checked too.
 */

const base = { company: 'Shopify', role: 'Engineer' };
const message = (result: ReturnType<typeof applicationInput.safeParse>) =>
  result.success ? null : result.error.issues.map((i) => i.message).join('; ');

describe('office location', () => {
  it('is required when nothing says the role is remote', () => {
    const result = applicationInput.safeParse(base);
    expect(result.success).toBe(false);
    expect(message(result)).toMatch(/where is the office/i);
  });

  it('is required for hybrid and onsite roles', () => {
    for (const remoteType of ['hybrid', 'onsite']) {
      expect(applicationInput.safeParse({ ...base, remoteType }).success).toBe(false);
    }
  });

  it('is not required for a fully remote role', () => {
    const result = applicationInput.safeParse({ ...base, remoteType: 'remote' });
    expect(result.success).toBe(true);
  });

  it('is still accepted on a remote role — a remote job can have an office', () => {
    const result = applicationInput.safeParse({
      ...base,
      remoteType: 'remote',
      location: 'Montreal, QC',
      locationPlaceId: 'ChIJabc',
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.location).toBe('Montreal, QC');
    expect(result.success && result.data.locationPlaceId).toBe('ChIJabc');
  });

  it('treats a form\'s empty string as no location at all', () => {
    expect(applicationInput.safeParse({ ...base, location: '   ' }).success).toBe(false);
  });

  it('applies to edits as well as to new applications', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    expect(applicationUpdateInput.safeParse({ ...base, id }).success).toBe(false);
    expect(
      applicationUpdateInput.safeParse({ ...base, id, location: 'Montreal, QC' }).success,
    ).toBe(true);
  });
});

describe('locationChangeInput', () => {
  const id = '00000000-0000-4000-8000-000000000000';

  it('accepts a place id with no text, so a tool can pass only what it looked up', () => {
    expect(locationChangeInput.safeParse({ id, locationPlaceId: 'ChIJabc' }).success).toBe(true);
  });

  it('rejects a call that names no address at all', () => {
    expect(locationChangeInput.safeParse({ id }).success).toBe(false);
  });
});
