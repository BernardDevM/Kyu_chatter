import type { NextFunction, Request, Response } from 'express';
import type { PrismaService } from '../prisma/prisma.service.js';

const ALLOWED_METHODS = 'GET, HEAD, OPTIONS';
const DB_TIMEOUT_MS = 10_000;

async function pingDatabase(prisma: PrismaService): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Database ping timed out')),
          DB_TIMEOUT_MS,
        );
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Uptime-monitor endpoint mounted at `/ping`. Answers GET, HEAD and OPTIONS
 * with a real `SELECT 1`, so a monitor also keeps the database awake.
 *
 * Must be mounted before `enableCors()`: the CORS middleware answers every
 * OPTIONS request itself and would otherwise never reach the database.
 * Sits outside the Nest pipeline, so no auth, envelope or request log.
 */
export function createPingHandler(prisma: PrismaService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path !== '/') {
      next();
      return;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      res.set('Allow', ALLOWED_METHODS).status(405).end();
      return;
    }

    const up = await pingDatabase(prisma);
    res.set({ Allow: ALLOWED_METHODS, 'Cache-Control': 'no-store' });

    if (req.method === 'OPTIONS') {
      res.status(up ? 204 : 503).end();
      return;
    }
    res.status(up ? 200 : 503).json({ status: up ? 'ok' : 'down' });
  };
}
