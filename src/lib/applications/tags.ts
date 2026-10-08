/**
 * Company sector tags — the limits and the cleaning, in a module of their own
 * so the form can show the limit without pulling zod and Drizzle into the
 * browser bundle through lib/applications/schema.ts.
 */

/** Most sector tags a company carries — enough to say what it is, few enough to scan. */
export const MAX_COMPANY_TAGS = 5;
/** Longest single tag. "Insurance" is 9; this leaves room for "Developer tools". */
export const MAX_TAG_LENGTH = 30;

/**
 * Splits, trims and de-duplicates a tag list, whichever shape it arrived in: the
 * form sends one comma-separated string, a tool sends an array. Case is kept as
 * written ("AI" must not become "Ai"), but "Fintech" and "fintech" are one tag.
 */
export function cleanTags(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map(String) : String(value).split(',');
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of list) {
    const tag = raw.trim();
    if (tag === '' || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  return tags;
}
