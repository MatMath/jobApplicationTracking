import { and, eq, type SQL } from 'drizzle-orm';
import {
  applications,
  companies,
  contacts,
  documents,
  meetings,
  notes,
  statusHistory,
} from './schema';

/**
 * Every user-owned table, keyed by name. Each carries `user_id` directly —
 * including the child tables — so ownership is always a single indexed
 * predicate rather than a join back through `applications`.
 */
const OWNED_TABLES = {
  applications,
  companies,
  contacts,
  documents,
  meetings,
  notes,
  statusHistory,
} as const;

export type OwnedTable = keyof typeof OWNED_TABLES;

/**
 * Builds the ownership predicate for a table, optionally AND-ed with more
 * conditions.
 *
 * In production on Supabase, Postgres RLS (`user_id = auth.uid()`) is the real
 * enforcement boundary. This is the belt to that suspenders, and the *only*
 * enforcement when running against local Postgres, which has no `auth.uid()`.
 * Route handlers must build every query through this rather than writing a bare
 * `where`, so that forgetting the user predicate is impossible instead of merely
 * unlikely — the old system hand-wrote `{ userId: req.user.userId }` on each
 * query, and one omission there silently leaked another user's rows.
 */
export function ownedBy(
  table: OwnedTable,
  userId: string,
  ...extra: (SQL | undefined)[]
): SQL {
  if (!userId) {
    throw new Error(`Refusing to build an unscoped query on "${table}".`);
  }
  const conditions = [eq(OWNED_TABLES[table].userId, userId), ...extra].filter(
    (c): c is SQL => c !== undefined,
  );
  // `and` returns undefined only for an empty list; the eq above guarantees one.
  return and(...conditions)!;
}
