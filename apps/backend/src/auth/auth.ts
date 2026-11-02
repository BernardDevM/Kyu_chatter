import { prisma } from '../prisma/prisma.client.js';
import { createBetterAuth } from './better-auth.js';

export const auth = createBetterAuth(prisma as any);
export type Auth = typeof auth;
