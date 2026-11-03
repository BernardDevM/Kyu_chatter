import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ServiceUnavailableException, type ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  function createMockHost(path = '/api/messages'): {
    host: ArgumentsHost;
    getStatus: () => number;
    getBody: () => Record<string, unknown>;
    getHeaders: () => Record<string, string>;
  } {
    let capturedStatus = 200;
    let capturedBody: Record<string, unknown> = {};
    const headers: Record<string, string> = {};

    const mockRequest = { originalUrl: path, url: path } as Request;
    const mockResponse = {
      setHeader: vi.fn((key: string, val: string) => {
        headers[key] = val;
      }),
      status: vi.fn((status: number) => {
        capturedStatus = status;
        return {
          json: vi.fn((body: Record<string, unknown>) => {
            capturedBody = body;
          }),
        };
      }),
    } as unknown as Response;

    const host = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;

    return {
      host,
      getStatus: () => capturedStatus,
      getBody: () => capturedBody,
      getHeaders: () => headers,
    };
  }

  it('maps class-validator BadRequestException to error details', () => {
    const { host, getStatus, getBody, getHeaders } = createMockHost();
    const validationError = new BadRequestException({
      statusCode: 400,
      message: ['name should not be empty', 'name must be longer than 1 character'],
      error: 'Bad Request',
    });

    filter.catch(validationError, host);

    expect(getStatus()).toBe(400);
    const body = getBody() as {
      success: boolean;
      error: {
        statusCode: number;
        message: string;
        details: string[];
        path: string;
      };
      meta: { nodeId: string };
    };

    expect(body.success).toBe(false);
    expect(body.error.statusCode).toBe(400);
    expect(body.error.message).toBe('Validation failed');
    expect(body.error.details).toEqual([
      'name should not be empty',
      'name must be longer than 1 character',
    ]);
    expect(getHeaders()['X-Node-Id']).toBeDefined();
  });

  it('maps Prisma P2002 error to 409 Conflict', () => {
    const { host, getStatus, getBody } = createMockHost();
    const prismaError = {
      code: 'P2002',
      message: 'Unique constraint failed on the fields: (`email`)',
    };

    filter.catch(prismaError, host);

    expect(getStatus()).toBe(409);
    const body = getBody() as {
      success: boolean;
      error: { statusCode: number; message: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.statusCode).toBe(409);
    expect(body.error.message).toBe('Resource already exists');
  });

  it('maps Prisma P2025 error to 404 Not Found', () => {
    const { host, getStatus, getBody } = createMockHost();
    const prismaError = {
      code: 'P2025',
      message: 'Record to update not found.',
    };

    filter.catch(prismaError, host);

    expect(getStatus()).toBe(404);
    const body = getBody() as {
      success: boolean;
      error: { statusCode: number; message: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.statusCode).toBe(404);
  });

  it('bypasses response envelope for health check exceptions', () => {
    const { host, getStatus, getBody, getHeaders } = createMockHost('/health/ready');
    const healthPayload = {
      status: 'degraded',
      checks: { database: 'up', redis: 'down' },
    };
    const exception = new ServiceUnavailableException(healthPayload);

    filter.catch(exception, host);

    expect(getStatus()).toBe(503);
    expect(getBody()).toEqual(healthPayload);
    expect(getHeaders()['X-Node-Id']).toBeDefined();
  });
});
