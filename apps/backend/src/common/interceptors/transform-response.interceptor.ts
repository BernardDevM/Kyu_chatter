import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { getNodeId } from '../utils/node-id.js';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    nodeId: string;
    timestamp: string;
  };
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const nodeId = getNodeId();
    if (response?.setHeader) {
      response.setHeader('X-Node-Id', nodeId);
    }

    const path = request?.originalUrl ?? request?.url ?? '';
    const isSkippedPath =
      path.startsWith('/api/auth') ||
      path.startsWith('/health') ||
      path === '/health' ||
      path.startsWith('/api/docs') ||
      path.startsWith('/docs');

    return next.handle().pipe(
      map((data) => {
        if (isSkippedPath || response?.statusCode === 204) {
          return data;
        }

        return {
          success: true,
          data,
          meta: {
            nodeId,
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}
