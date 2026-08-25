import type { InferSelectModel } from 'drizzle-orm';
import type { applications, companies, contacts, meetings } from '@/db/schema';

/**
 * Drizzle infers property names in camelCase, but PostgREST returns the raw
 * column names in snake_case. Rather than maintaining a second hand-written set
 * of row types that can silently drift, convert at the type level so schema.ts
 * stays the single source of truth for both paths.
 */
type SnakeCase<S extends string> = S extends `${infer C}${infer Rest}`
  ? C extends Uppercase<C>
    ? C extends Lowercase<C>
      ? `${C}${SnakeCase<Rest>}` // digit or symbol: no separator
      : `_${Lowercase<C>}${SnakeCase<Rest>}`
    : `${C}${SnakeCase<Rest>}`
  : S;

type SnakeCaseKeys<T> = {
  [K in keyof T as K extends string ? SnakeCase<K> : K]: T[K];
};

/** camelCase rows, as returned by Drizzle over DATABASE_URL. */
export type Company = InferSelectModel<typeof companies>;
export type Contact = InferSelectModel<typeof contacts>;
export type Meeting = InferSelectModel<typeof meetings>;
export type Application = InferSelectModel<typeof applications>;

/** snake_case rows, as returned by supabase-js over PostgREST. */
export type CompanyRow = SnakeCaseKeys<Company>;
export type ContactRow = SnakeCaseKeys<Contact>;
export type MeetingRow = SnakeCaseKeys<Meeting>;
export type ApplicationRow = SnakeCaseKeys<Application>;

export type ApplicationWithCompany = ApplicationRow & {
  companies: Pick<CompanyRow, 'id' | 'name'> | null;
};

/** Human labels for the pipeline, kept next to the values they describe. */
export const STATUS_LABELS: Record<string, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const APPLICATION_TYPE_LABELS: Record<string, string> = {
  recruiter: 'Via recruiter',
  direct: 'Direct',
};

export const REMOTE_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Onsite',
};

/** Seeded from the old system's observed values; free text is still allowed. */
export const COMMON_PLATFORMS = [
  'LinkedIn',
  'Indeed',
  'Glassdoor',
  'Company Site',
  'Referral',
  'Recruiter',
  'Other',
];
