import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export const dbPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const prismaAdapterInstance = new PrismaPg(dbPool);

export const prisma = new PrismaClient({
  adapter: prismaAdapterInstance,
});
