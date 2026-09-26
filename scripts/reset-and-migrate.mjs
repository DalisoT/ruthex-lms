// scripts/reset-and-migrate.mjs
//
// DESTRUCTIVE: drops every table in the public schema, then applies the
// Drizzle migration from ./drizzle. Used to clear the leftover Prisma-flavored
// tables on Neon before the new Drizzle schema takes over. Will be removed
// once the live schema stabilises.

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Configure it in .env or as an env var.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

console.log('Dropping all tables in public schema...');
await sql`DROP SCHEMA public CASCADE`;
await sql`CREATE SCHEMA public`;
console.log('  schema reset.');

const db = drizzle(sql);
console.log('Running migrations from ./drizzle against Neon...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied successfully.');
process.exit(0);
