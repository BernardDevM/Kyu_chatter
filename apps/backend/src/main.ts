import 'dotenv/config';
import dns from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { RedisIoAdapter } from './realtime/redis-io.adapter.js';

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const frontendOrigins = (process.env.FRONTEND_URLS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: frontendOrigins,
    credentials: true,
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
