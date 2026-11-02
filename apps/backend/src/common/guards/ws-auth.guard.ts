import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { fromNodeHeaders } from 'better-auth/node';
import type { Socket } from 'socket.io';
import { auth } from '../../auth/auth.js';

@Injectable()
export class WsAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    if (!client) {
      throw new WsException('Invalid socket context');
    }

    // Already authenticated
    if (client.data?.user) {
      return true;
    }

    const headers = fromNodeHeaders(client.handshake?.headers || {});
    try {
      const session = await auth.api.getSession({ headers });
      if (session?.user) {
        client.data.user = session.user;
        client.data.session = session;
        return true;
      }
    } catch {
      // Continue to dev check
    }

    // Development fallback
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEV_USER_HEADER === 'true'
    ) {
      const devHeader = client.handshake?.headers?.['x-dev-user-id'];
      const devAuthUser =
        (client.handshake?.auth as { userId?: string } | undefined)?.userId ??
        (Array.isArray(devHeader) ? devHeader[0] : devHeader);

      if (typeof devAuthUser === 'string' && devAuthUser.trim().length > 0) {
        client.data.user = {
          id: devAuthUser.trim(),
          name: 'Dev User',
          email: `${devAuthUser.trim()}@example.com`,
        };
        return true;
      }
    }

    throw new WsException('Unauthorized: Valid session or token required');
  }
}
