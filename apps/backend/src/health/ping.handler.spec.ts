import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createPingHandler } from './ping.handler.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('createPingHandler', () => {
  const queryRaw = vi.fn();
  let app: INestApplication;

  beforeEach(async () => {
    queryRaw.mockReset().mockResolvedValue([{ '?column?': 1 }]);

    const moduleRef = await Test.createTestingModule({}).compile();
    app = moduleRef.createNestApplication();
    // Same order as main.ts: ping first, CORS after.
    app.use(
      '/ping',
      createPingHandler({ $queryRaw: queryRaw } as unknown as PrismaService),
    );
    app.enableCors({ origin: [], credentials: true });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(['get', 'head', 'options'] as const)(
    'pings the database on %s',
    async (method) => {
      const res = await request(app.getHttpServer())[method]('/ping');

      expect(res.status).toBe(method === 'options' ? 204 : 200);
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(res.headers['cache-control']).toBe('no-store');
    },
  );

  it('returns a JSON body on GET only', async () => {
    const server = app.getHttpServer();

    expect((await request(server).get('/ping')).body).toEqual({ status: 'ok' });
    expect((await request(server).head('/ping')).text).toBeFalsy();
  });

  it.each(['get', 'head', 'options'] as const)(
    'returns 503 on %s when the database is down',
    async (method) => {
      queryRaw.mockRejectedValue(new Error('connection refused'));

      const res = await request(app.getHttpServer())[method]('/ping');

      expect(res.status).toBe(503);
    },
  );

  it('rejects other methods with 405', async () => {
    const res = await request(app.getHttpServer()).post('/ping');

    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe('GET, HEAD, OPTIONS');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('ignores sub-paths', async () => {
    const res = await request(app.getHttpServer()).get('/ping/extra');

    expect(res.status).toBe(404);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
