import type { Config } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  // auth/storage are Supabase-managed; only diff our own tables.
  schemaFilter: ['public'],
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
} satisfies Config;
