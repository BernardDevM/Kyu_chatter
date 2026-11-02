import { Global, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { LoggingInterceptor } from './interceptors/logging.interceptor.js';
import { TransformResponseInterceptor } from './interceptors/transform-response.interceptor.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RoomMemberGuard } from './guards/room-member.guard.js';
import { RoomAdminGuard } from './guards/room-admin.guard.js';
import { RoomOwnerGuard } from './guards/room-owner.guard.js';
import { WsAuthGuard } from './guards/ws-auth.guard.js';
import { WsThrottleGuard } from './guards/ws-throttle.guard.js';

@Global()
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    AuthGuard,
    RoomMemberGuard,
    RoomAdminGuard,
    RoomOwnerGuard,
    WsAuthGuard,
    WsThrottleGuard,
  ],
  exports: [
    AuthGuard,
    RoomMemberGuard,
    RoomAdminGuard,
    RoomOwnerGuard,
    WsAuthGuard,
    WsThrottleGuard,
  ],
})
export class CommonModule {}
