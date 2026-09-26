// scripts/migrate.mjs
//
// Apply Drizzle migrations to Neon Postgres via the neon-http driver.
// The `drizzle-kit push` introspection step hangs because @neondatabase/
// serverless doesn't speak the postgres protocol over websocket on Windows.
// Using Drizzle's own migrator avoids the introspection round-trip entirely.

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Configure it in .env or as an env var.');
  process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL));

console.log('Running migrations from ./drizzle against Neon...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied successfully.');
process.exit(0);
