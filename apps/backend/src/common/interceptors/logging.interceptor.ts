import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { getNodeId } from '../utils/node-id.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<
      Request & {
        user?: { id?: string };
        session?: { user?: { id?: string } };
      }
    >();
    const response = http.getResponse<Response>();

    const startTime = Date.now();
    const method = request?.method ?? 'UNKNOWN';
    const url = request?.originalUrl ?? request?.url ?? '';
    const nodeId = getNodeId();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response?.statusCode ?? 200;
          const userId =
            request?.user?.id ??
            request?.session?.user?.id ??
            (request?.headers?.['x-dev-user-id'] as string | undefined);
          const userPart = userId ? ` userId: ${userId}` : '';
          this.logger.log(
            `${method} ${url} ${statusCode} ${duration}ms [nodeId: ${nodeId}${userPart}]`,
          );
        },
        error: (err: unknown) => {
          const duration = Date.now() - startTime;
          const statusCode =
            typeof err === 'object' && err !== null && 'status' in err
              ? (err as { status: number }).status
              : (response?.statusCode ?? 500);
          const userId =
            request?.user?.id ??
            request?.session?.user?.id ??
            (request?.headers?.['x-dev-user-id'] as string | undefined);
          const userPart = userId ? ` userId: ${userId}` : '';
          this.logger.warn(
            `${method} ${url} ${statusCode} ${duration}ms [nodeId: ${nodeId}${userPart}]`,
          );
        },
      }),
    );
  }
}
