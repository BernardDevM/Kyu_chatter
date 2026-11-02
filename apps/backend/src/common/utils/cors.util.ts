/**
 * CORS configuration utility for HTTP and WebSocket gateways.
 */

/**
 * Resolves the list of trusted frontend origins.
 * In development, ensures common local dev server origins (Vite/React on 5173/5174, etc.)
 * are always included even if FRONTEND_URLS is omitted or partially defined.
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  if (process.env.NODE_ENV === 'production') {
    return envOrigins.length > 0 ? envOrigins : ['http://localhost:3000'];
  }

  return Array.from(new Set([...envOrigins, ...defaultDevOrigins]));
}

/**
 * Checks whether an incoming origin is permitted.
 * In development, permits all localhost and 127.0.0.1 origins on any port.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Non-browser or same-origin requests (e.g. curl, mobile, server-to-server)
    return true;
  }

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Allow any localhost/127.0.0.1 port in non-production
  if (process.env.NODE_ENV !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return true;
    }
  }

  return false;
}

/**
 * Standard CORS origin callback for Express and Socket.IO.
 */
export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  }
}
