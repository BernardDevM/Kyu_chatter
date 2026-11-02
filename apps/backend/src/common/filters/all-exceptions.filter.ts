import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getNodeId } from '../utils/node-id.js';

interface ErrorPayload {
  statusCode: number;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

interface ErrorEnvelope {
  success: false;
  error: ErrorPayload;
  meta: {
    nodeId: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const nodeId = getNodeId();
    if (response && typeof response.setHeader === 'function') {
      response.setHeader('X-Node-Id', nodeId);
    }

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: unknown = undefined;

    // Check for Prisma errors (P2002, P2025, etc.)
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as { code: unknown }).code === 'string'
    ) {
      const code = (exception as { code: string }).code;
      if (code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        message = 'Resource already exists';
      } else if (code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
      } else {
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database error';
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          details = resObj.message;
        } else if (typeof resObj.message === 'string') {
          message = resObj.message;
        } else if (typeof resObj.error === 'string') {
          message = resObj.error;
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message || 'Internal server error';
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${request?.method ?? 'UNKNOWN'} ${request?.originalUrl ?? request?.url ?? ''} - 5xx Error: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const path = request?.originalUrl ?? request?.url ?? '';
    const errorBody: ErrorEnvelope = {
      success: false,
      error: {
        statusCode,
        message,
        ...(details !== undefined ? { details } : {}),
        path,
        timestamp: new Date().toISOString(),
      },
      meta: {
        nodeId,
      },
    };

    response.status(statusCode).json(errorBody);
  }
}
