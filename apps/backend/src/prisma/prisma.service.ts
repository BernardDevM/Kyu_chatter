import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { dbPool, prismaAdapterInstance } from './prisma.client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ adapter: prismaAdapterInstance });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to the database.');
    } catch (error) {
      this.logger.error('Failed to connect to the database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await dbPool.end();
  }
}
