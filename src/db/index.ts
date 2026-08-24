import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

/**
 * Next dev reloads modules on every edit; without caching the client on
 * globalThis each reload opens a new pool and Postgres runs out of connections.
 */
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

const client =
  globalForDb.pg ?? postgres(connectionString, { max: process.env.NODE_ENV === 'production' ? 10 : 1 });

if (process.env.NODE_ENV !== 'production') globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };
