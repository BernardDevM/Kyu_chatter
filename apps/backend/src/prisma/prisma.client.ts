import dns from 'node:dns/promises';
import pg from 'pg';
import "dotenv/config"

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured.');
}

if (
  (databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
  (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))
) {
  databaseUrl = databaseUrl.slice(1, -1);
}

const url = new URL(databaseUrl);
const hostname = url.hostname;

// Resolve the Neon hostname dynamically to IPv4.
const { address } = await dns.lookup(hostname, {
  family: 4,
});



// Create the PostgreSQL connection pool.
export const dbPool = new pg.Pool({
  host: address,
  port: Number(url.port || 5432),
  database: decodeURIComponent(url.pathname.slice(1)),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),

  // Preserve hostname verification for Neon TLS.
  ssl: {
    rejectUnauthorized: true,
    servername: hostname,
  },

  connectionTimeoutMillis: 30000,
  max: 10,
  idleTimeoutMillis: 30000,
});

// Log unexpected pool errors.
dbPool.on('error', (error) => {
  console.error('[Database] Unexpected PostgreSQL pool error:', error);
});

// Initialize Prisma's PostgreSQL adapter.
export const prismaAdapterInstance = new PrismaPg(dbPool);

// Export the shared Prisma client.
export const prisma = new PrismaClient({
  adapter: prismaAdapterInstance,
});

