import { fromNodeHeaders } from 'better-auth/node';
import type { Socket } from 'socket.io';
import { auth } from '../../auth/auth.js';

export interface SocketUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  [key: string]: unknown;
}

/**
 * Checks if development user header fallback is permitted.
 * Strictly forbidden in production environments.
 */
export function isDevAuthAllowed(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_DEV_USER_HEADER === 'true'
  );
}

/**
 * Resolves an authenticated user from a Socket.IO connection.
 * Authentication order:
 * 1. Better Auth session (via cookies or Bearer token header)
 * 2. Development identity (only when isDevAuthAllowed() is true)
 *
 * In production, any handshake carrying dev headers or auth.userId is ignored.
 */
export async function resolveSocketUser(
  client: Socket,
): Promise<SocketUser | null> {
  // 1. Better Auth session resolution
  try {
    const rawHeaders = client.handshake?.headers || {};
    const headers = fromNodeHeaders(rawHeaders);

    // If client supplied auth.token in handshake, ensure it is considered if Authorization header missing
    const authToken = (client.handshake?.auth as { token?: string } | undefined)?.token;
    if (!headers.has('authorization') && typeof authToken === 'string' && authToken.trim().length > 0) {
      headers.set('authorization', `Bearer ${authToken.trim()}`);
    }

    const session = await auth.api.getSession({ headers });
    if (session?.user?.id) {
      return session.user as SocketUser;
    }
  } catch {
    // Session lookup failed or no active session
  }

  // 2. Development identity fallback (only if explicitly allowed)
  if (isDevAuthAllowed()) {
    const devHeader = client.handshake?.headers?.['x-dev-user-id'];
    const devAuthUser =
      (client.handshake?.auth as { userId?: string } | undefined)?.userId ??
      (Array.isArray(devHeader) ? devHeader[0] : devHeader);

    if (typeof devAuthUser === 'string' && devAuthUser.trim().length > 0) {
      const trimmedId = devAuthUser.trim();
      return {
        id: trimmedId,
        name: 'Dev User',
        email: `${trimmedId}@example.com`,
      };
    }
  }

  return null;
}
