import 'dotenv/config';
import dns from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module.js';
import { createPingHandler } from './health/ping.handler.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisIoAdapter } from './realtime/redis-io.adapter.js';
import { corsOriginCallback } from './common/utils/cors.util.js';

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Behind reverse proxy (Traefik)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Enable graceful shutdown hooks for container lifecycle
  app.enableShutdownHooks();

  // Security headers: relax CSP on Swagger UI docs
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.url || '';
    if (path.startsWith('/api/docs') || path.startsWith('/docs')) {
      return helmet({
        contentSecurityPolicy: false,
      })(req, res, next);
    }
    return helmet()(req, res, next);
  });

  // Before enableCors(): CORS would answer OPTIONS /ping without hitting the DB.
  app.use('/ping', createPingHandler(app.get(PrismaService)));
  app.enableCors({
    origin: corsOriginCallback,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-dev-user-id',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['X-Node-Id'],
  });

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kyu Chatter API')
    .setDescription(
      'Distributed real-time chat application API documentation, schemas, and contract placeholders.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT / Session',
        description: 'Better Auth session cookie or bearer token',
      },
      'session-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-dev-user-id',
        in: 'header',
        description:
          'Development-only user header for local testing without cookies (NODE_ENV !== "production")',
      },
      'dev-user-id',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(
    `Server running on port ${port}. Swagger UI available at /api/docs`,
  );
}
await bootstrap();
