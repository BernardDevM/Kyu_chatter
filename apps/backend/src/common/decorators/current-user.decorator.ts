import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Extracts the authenticated user or a specific user property from the request.
 * Supports a development-only fallback when ALLOW_DEV_USER_HEADER=true.
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<{
      user?: Record<string, unknown>;
      session?: { user?: Record<string, unknown> };
      headers?: Record<string, string | string[] | undefined>;
    }>();

    let user: Record<string, unknown> | undefined =
      request?.user ?? request?.session?.user;

    // Development-only fallback
    if (
      !user &&
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEV_USER_HEADER === 'true'
    ) {
      // TODO(guards): remove dev header fallback
      const devHeader = request?.headers?.['x-dev-user-id'];
      const devUserId = Array.isArray(devHeader) ? devHeader[0] : devHeader;
      if (typeof devUserId === 'string' && devUserId.trim().length > 0) {
        user = { id: devUserId.trim() };
      }
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (data) {
      const val = user[data];
      if (val === undefined) {
        throw new UnauthorizedException(`User property "${data}" not found`);
      }
      return val;
    }

    return user;
  },
);
