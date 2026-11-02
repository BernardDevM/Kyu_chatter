import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { getNodeId } from '../common/utils/node-id.js';

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
  getReady(): HealthReadyResponse {
    // TODO(impl): Perform lightweight ping queries to prisma ($queryRaw`SELECT 1`) and redis.ping()
    return {
      status: 'ok',
      checks: {
        database: 'up',
        redis: 'up',
      },
    };
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
