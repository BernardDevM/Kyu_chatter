import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { dbPool, prismaAdapterInstance } from './prisma.client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ adapter: prismaAdapterInstance });
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
    await dbPool.end();
  }
}
