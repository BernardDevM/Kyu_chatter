import { Global, Module } from '@nestjs/common';
import { RealtimeEmitter } from './realtime-emitter.service.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  providers: [RedisService, RealtimeEmitter],
  exports: [RedisService, RealtimeEmitter],
})
export class RealtimeModule {}
