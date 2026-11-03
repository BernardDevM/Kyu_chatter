import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { getNodeId } from '../common/utils/node-id.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../realtime/redis.service.js';

export interface HealthLiveResponse {
  status: 'ok';
}

export interface HealthReadyResponse {
  status: 'ok' | 'degraded';
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}

export interface HealthNodeResponse {
  nodeId: string;
  uptimeSeconds: number;
  timestamp: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Basic liveness probe indicating the HTTP process is alive and responsive.
   */
  @Public()
  @ApiOperation({ summary: 'Liveness probe' })
  @Get('live')
  getLive(): HealthLiveResponse {
    return { status: 'ok' };
  }

  /**
   * Readiness probe checking dependencies (database, Redis cache).
   */
  @Public()
  @ApiOperation({ summary: 'Readiness probe checking database and redis' })
  @Get('ready')
  async getReady(): Promise<HealthReadyResponse> {
    let database: 'up' | 'down' = 'up';
    let redis: 'up' | 'down' = 'up';

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      database = 'down';
    }

    try {
      await this.redis.ping();
    } catch {
      redis = 'down';
    }

    const isHealthy = database === 'up' && redis === 'up';
    const result: HealthReadyResponse = {
      status: isHealthy ? 'ok' : 'degraded',
      checks: {
        database,
        redis,
      },
    };

    if (!isHealthy) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }

  /**
   * Node diagnostic probe returning cluster node identifier and uptime.
   */
  @Public()
  @ApiOperation({ summary: 'Node identity and uptime probe' })
  @Get('node')
  getNode(): HealthNodeResponse {
    return {
      nodeId: getNodeId(),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
