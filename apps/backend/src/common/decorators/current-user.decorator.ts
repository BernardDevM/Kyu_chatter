
import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

interface AuthenticatedRequest {
  user?: Record<string, unknown> | null;
  session?: {
    user?: Record<string, unknown>;
  } | null;
}

/**
 * Extracts the authenticated user or a specific user property.
 *
 * Authentication must already have been validated by Better Auth's AuthGuard.
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const user = request.user ?? request.session?.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (data) {
      const value = user[data];

      if (value === undefined || value === null) {
        throw new UnauthorizedException(
          `User property "${data}" not found`,
        );
      }

      return value;
    }

    return user;
  },
);
