import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { applications, companies, contacts, meetings, notes, profiles } from './schema';

/**
 * schema.ts and the SQL have to describe the same database.
 *
 * Nothing else checks this. Drizzle's `db:push` would, but it connects over
 * DATABASE_URL, and the SQL files are applied by hand in the Supabase editor —
 * so a column can be added here, used by the write path, and never actually
 * created. The symptom is a runtime error from PostgREST, not a failing build:
 *
 *   Could not find the 'location_lat' column of 'applications' in the schema cache
 *
 * These tests do not know whether a migration has been *run* — no test can, and
 * that is a deploy step. They catch the half of it that is in the repo: code
 * that writes a column no migration declares.
 */

const SUPABASE_DIR = join(__dirname, '..', '..', 'supabase');

/** Every .sql in supabase/, concatenated: bootstrap plus the numbered files. */
function allSql(): string {
  return readdirSync(SUPABASE_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(SUPABASE_DIR, f), 'utf8'))
    .join('\n')
    .toLowerCase();
}

/** Table-level clauses that open a line inside a create table body. */
const NOT_A_COLUMN = new Set(['constraint', 'primary', 'unique', 'foreign', 'check', 'exclude']);

/**
 * Columns the SQL actually *declares* for one table — from a create table body
 * or an `add column`, and from nowhere else.
 *
 * Searching the whole file for the name instead would let a column through on
 * a mention in an index or a policy: `location_lat` is named by the partial
 * index in 004, so a loose match called it declared even with its `add column`
 * deleted. That is the exact failure this file exists to catch.
 */
function declaredColumns(sql: string, table: string): Set<string> {
  const columns = new Set<string>();

  for (const block of sql.matchAll(
    new RegExp(`create table[^(]*\\b${table}\\b[^(]*\\(([\\s\\S]*?)\\n\\);`, 'g'),
  )) {
    for (const line of block[1].split('\n')) {
      const first = line.trim().split(/\s+/)[0]?.replace(/[",]/g, '');
      if (!first || first.startsWith('--') || NOT_A_COLUMN.has(first)) continue;
      columns.add(first);
    }
  }

  for (const statement of sql.matchAll(new RegExp(`alter table[^;]*\\b${table}\\b[^;]*;`, 'g'))) {
    for (const added of statement[0].matchAll(
      /add column\s+(?:if not exists\s+)?([a-z_][a-z0-9_]*)/g,
    )) {
      columns.add(added[1]);
    }
  }

  return columns;
}

/**
 * Column names as Postgres will see them — read off the Drizzle table rather
 * than parsed out of the source, so a rename cannot slip past by changing only
 * the property name.
 */
function columnNames(table: Parameters<typeof getTableColumns>[0]): string[] {
  return Object.values(getTableColumns(table)).map((c) => c.name);
}

const TABLES = { applications, companies, contacts, meetings, notes, profiles };

describe('schema.ts and supabase/*.sql agree', () => {
  const sql = allSql();

  for (const [name, table] of Object.entries(TABLES)) {
    it(`every ${name} column is declared in SQL`, () => {
      const declared = declaredColumns(sql, name);
      // The parser finding nothing at all means it stopped understanding the
      // file, not that the table is empty — fail loudly rather than pass.
      expect(declared.size, `no columns parsed for ${name}`).toBeGreaterThan(0);

      const missing = columnNames(table).filter((column) => !declared.has(column));
      expect(missing, `never declared in supabase/*.sql: ${missing.join(', ')}`).toEqual([]);
    });
  }

  it('carries the office location columns the map depends on', () => {
    // Named explicitly as well as covered by the sweep above: these three are
    // the ones the dashboard map cannot work without, and the loop would still
    // pass if someone deleted them from schema.ts and from the write path.
    expect(columnNames(applications)).toEqual(
      expect.arrayContaining(['location', 'location_place_id', 'location_lat', 'location_lng']),
    );
  });

  it('adds new columns with `if not exists`, so a migration can be re-run', () => {
    const migrations = readdirSync(SUPABASE_DIR).filter((f) => /^\d+.*\.sql$/.test(f));
    expect(migrations.length).toBeGreaterThan(0);

    for (const file of migrations) {
      const body = readFileSync(join(SUPABASE_DIR, file), 'utf8').toLowerCase();
      for (const [, clause] of body.matchAll(/add column\s+([^,;]+)/g)) {
        expect(clause, `${file}: "add column ${clause.trim()}" is not idempotent`).toContain(
          'if not exists',
        );
      }
    }
  });
});
