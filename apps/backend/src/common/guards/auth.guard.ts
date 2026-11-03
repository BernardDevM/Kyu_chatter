import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { auth } from '../../auth/auth.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (typeof context.getType === 'function' && context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>('PUBLIC', [
      context.getHandler(),
      context.getClass(),
    ]);

    const http = context.switchToHttp();
    const request = http.getRequest<
      Request & {
        user?: Record<string, unknown>;
        session?: Record<string, unknown>;
      }
    >();

    const path = request?.originalUrl ?? request?.url ?? '';

    // Allow public routes and health / docs / auth endpoints
    if (
      isPublic ||
      path.startsWith('/health') ||
      path === '/health' ||
      path.startsWith('/api/docs') ||
      path.startsWith('/docs') ||
      path.startsWith('/api/auth')
    ) {
      await this.tryPopulateUser(request);
      return true;
    }

    const authenticated = await this.tryPopulateUser(request);
    if (authenticated) {
      return true;
    }

    const isOptional = this.reflector.getAllAndOverride<boolean>('OPTIONAL', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isOptional) {
      return true;
    }

    throw new UnauthorizedException('Authentication required');
  }

  private async tryPopulateUser(
    request: Request & {
      user?: Record<string, unknown>;
      session?: Record<string, unknown>;
    },
  ): Promise<boolean> {
    try {
      if (request?.headers) {
        const headers = fromNodeHeaders(request.headers);
        const authHeader = request.headers.authorization;

        // Map Bearer token (from Swagger UI or API clients) to session cookie if needed
        if (authHeader && authHeader.startsWith('Bearer ') && !headers.get('cookie')) {
          const token = authHeader.slice(7).trim();
          headers.set('cookie', `better-auth.session_token=${token}`);
        }

        const session = await auth.api.getSession({
          headers,
        });

        if (session?.user) {
          request.session = session as unknown as Record<string, unknown>;
          request.user = session.user as unknown as Record<string, unknown>;
          return true;
        }
      }
    } catch {
      // Ignore session fetch errors and proceed to fallback
    }

    // Development-only fallback header or dev Bearer token (e.g. Bearer dev-user-123)
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEV_USER_HEADER === 'true'
    ) {
      const devHeader = request?.headers?.['x-dev-user-id'];
      let devUserId = Array.isArray(devHeader) ? devHeader[0] : devHeader;

      if (!devUserId && request?.headers?.authorization?.startsWith('Bearer dev-')) {
        const bearer = request.headers.authorization.slice(7).trim();
        if (bearer.length > 0) {
          devUserId = bearer;
        }
      }

      if (typeof devUserId === 'string' && devUserId.trim().length > 0) {
        const devUser = {
          id: devUserId.trim(),
          name: 'Dev User',
          email: `${devUserId.trim()}@example.com`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        request.user = devUser;
        request.session = {
          user: devUser,
          session: {
            id: 'dev-session-id',
            userId: devUser.id,
            token: 'dev-session-token',
            expiresAt: new Date(Date.now() + 86400000),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        };
        return true;
      }
    }

    return false;
  }
}
