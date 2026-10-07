import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { documentUploadInput } from './schema';
import { storeDocument } from './write';

/**
 * A refused file must be refused before anything is asked of Supabase — not
 * uploaded and then cleaned up. The client here throws on any use at all, so a
 * test passing means the refusal happened first.
 *
 * What happens after a file is accepted (the dedupe, the default résumé, the
 * attachment rules, and the policies behind them) depends on the real database
 * and bucket and is verified against them; see the commit that added this.
 */
const untouchable = new Proxy(
  {},
  {
    get(_target, property) {
      throw new Error(`Supabase was reached (${String(property)}) for a file that should have been refused.`);
    },
  },
) as unknown as SupabaseClient;

const input = (over: Record<string, unknown> = {}) => documentUploadInput.parse(over);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

describe('storeDocument', () => {
  it('refuses an image without storing anything', async () => {
    const result = await storeDocument(untouchable, 'user-1', { fileName: 'headshot.png', bytes: PNG }, input());
    expect(result.error).toContain('.png files are not accepted');
  });

  it('refuses an image hiding behind a text extension', async () => {
    const result = await storeDocument(untouchable, 'user-1', { fileName: 'cv.md', bytes: PNG }, input());
    expect(result.error).toContain('not plain text');
  });

  it('refuses a file over 1 MB', async () => {
    const bytes = new Uint8Array(1024 * 1024 + 1).fill(0x61);
    const result = await storeDocument(untouchable, 'user-1', { fileName: 'notes.txt', bytes }, input());
    expect(result.error).toContain('limit is 1 MB');
  });

  it('refuses an interview round with no application to belong to', async () => {
    const result = await storeDocument(
      untouchable,
      'user-1',
      { fileName: 'brief.md', bytes: new TextEncoder().encode('# Brief') },
      input({ meetingId: '00000000-0000-4000-8000-000000000000' }),
    );
    expect(result.error).toContain('meetingId');
  });
});

describe('documentUploadInput', () => {
  it('treats a blank form field and a missing key the same way', () => {
    expect(input({ type: '', applicationId: '', meetingId: '' })).toEqual({
      type: 'other',
      applicationId: null,
      meetingId: null,
      makeDefaultResume: false,
    });
  });

  it('reads a checkbox and a boolean as the same flag', () => {
    expect(input({ makeDefaultResume: 'on' }).makeDefaultResume).toBe(true);
    expect(input({ makeDefaultResume: true }).makeDefaultResume).toBe(true);
  });

  it('rejects a type the library does not have', () => {
    expect(documentUploadInput.safeParse({ type: 'headshot' }).success).toBe(false);
  });
});
