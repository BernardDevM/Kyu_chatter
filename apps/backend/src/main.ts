import 'dotenv/config';
import dns from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();