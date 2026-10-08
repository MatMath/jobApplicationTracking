import { describe, expect, it } from 'vitest';
import {
  applicationInput,
  applicationUpdateInput,
  companyTagsInput,
  locationChangeInput,
} from './schema';

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

/**
 * Company tags tell "absent" from "empty", unlike every other optional field:
 * absent leaves the company's tags alone, empty clears them. The two callers
 * produce each differently — a tool omits the key, a form sends a blank
 * string — so both are checked from the schema's side.
 */
describe('company tags', () => {
  const remote = { ...base, remoteType: 'remote' };
  const tagsOf = (companyTags: unknown) => {
    const result = applicationInput.safeParse({ ...remote, companyTags });
    return result.success ? result.data.companyTags : result.error.issues.map((i) => i.message);
  };

  it('are left alone when the caller does not mention them', () => {
    const result = applicationInput.safeParse(remote);
    expect(result.success && result.data.companyTags).toBeNull();
    expect(tagsOf(null)).toBeNull();
  });

  it('are cleared by an empty list or a blank form field', () => {
    expect(tagsOf([])).toEqual([]);
    expect(tagsOf('')).toEqual([]);
    expect(tagsOf('  ,  ')).toEqual([]);
  });

  it('take a tool\'s array or a form\'s comma-separated string', () => {
    expect(tagsOf(['Fintech', 'AI'])).toEqual(['Fintech', 'AI']);
    expect(tagsOf('Fintech, AI ,Insurance')).toEqual(['Fintech', 'AI', 'Insurance']);
  });

  it('keep their case but collapse repeats that differ only by it', () => {
    expect(tagsOf(['AI', 'ai', 'Fintech', ' FINTECH '])).toEqual(['AI', 'Fintech']);
  });

  it('allow five and refuse a sixth, saying so', () => {
    expect(tagsOf('a, b, c, d, e')).toHaveLength(5);
    expect(tagsOf('a, b, c, d, e, f')).toEqual([expect.stringMatching(/at most 5 tags/i)]);
  });

  it('refuse a tag too long to be a label', () => {
    expect(tagsOf(['x'.repeat(31)])).toEqual([expect.stringMatching(/at most 30 characters/i)]);
  });

  it('are read on edits too', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const result = applicationUpdateInput.safeParse({ ...remote, id, companyTags: 'Bank' });
    expect(result.success && result.data.companyTags).toEqual(['Bank']);
  });
});

describe('companyTagsInput', () => {
  const id = '00000000-0000-4000-8000-000000000000';

  it('requires a list, and treats a missing one as empty rather than as "keep"', () => {
    const result = companyTagsInput.safeParse({ id });
    expect(result.success && result.data.tags).toEqual([]);
  });

  it('holds the same ceiling as the application form', () => {
    expect(companyTagsInput.safeParse({ id, tags: ['a', 'b', 'c', 'd', 'e', 'f'] }).success).toBe(false);
  });
});
