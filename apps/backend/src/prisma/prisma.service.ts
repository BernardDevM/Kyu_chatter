
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: pg.Pool;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured.');
    }

    const pool = new pg.Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 30000,
      max: 10,
      idleTimeoutMillis: 30000,
    });

    pool.on('error', (error) => {
      Logger.error(
        `Unexpected PostgreSQL pool error: ${error.message}`,
        undefined,
        PrismaService.name,
      );
    });

    super({
      adapter: new PrismaPg(pool),
    });

    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();

      // Verify that a database query can actually execute.
      await this.$queryRaw`SELECT 1`;

      this.logger.log('Successfully connected to the database.');
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL.');

      if (error instanceof Error) {
        this.logger.error(error.message);
      }

      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
